"""Statistiques agrégées pour les tableaux de bord web (un widget par rôle).
Toutes les valeurs sont calculées à la volée depuis Postgres — rien n'est mis en cache
ni précalculé, le volume de données de cette plateforme ne le justifie pas."""
from calendar import month_abbr
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, KycStatus, KycVerification, User, Workflow, WorkflowStatus, WorkflowType
from ..auth import get_current_user, get_current_admin
from ..blockchain import BlockchainClient

router = APIRouter(tags=["Stats"])

blockchain_client = BlockchainClient()


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _last_n_months(now: datetime, n: int) -> list[datetime]:
    """Les débuts de mois des n derniers mois (le plus ancien en premier)."""
    months = []
    cursor = _month_start(now)
    for _ in range(n):
        months.append(cursor)
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    return list(reversed(months))


def _bucket_by_month(timestamps: list[datetime], months: list[datetime]) -> list[dict]:
    counts = defaultdict(int)
    for ts in timestamps:
        key = ts.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        counts[key] += 1
    return [
        {"month": month_abbr[m.month], "count": counts.get(m, 0)}
        for m in months
    ]


@router.get("/stats/overview")
def get_stats_overview(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    role = current_user["role"]
    if role == "ADMIN":
        return _admin_overview(db, now)
    if role == "ISSUER":
        return _issuer_overview(db, current_user, now)
    if role == "VERIFIER":
        return _verifier_overview(db, current_user, now)
    if role == "BANK":
        return _bank_overview(db, current_user, now)
    if role == "NOTARY":
        return _notary_overview(db, current_user, now)
    return _user_overview(db, current_user)


def _admin_overview(db: Session, now: datetime) -> dict:
    month_start = _month_start(now)

    def counts(query, date_col):
        total = query.count()
        this_month = query.filter(date_col >= month_start).count()
        return total, this_month

    actors_total, actors_month = counts(db.query(User).filter(User.is_active == True), User.created_at)
    documents_total, documents_month = counts(db.query(Document), Document.created_at)
    land_titles_total, land_titles_month = counts(
        db.query(Document).filter(Document.doc_type == "LAND_TITLE"), Document.created_at
    )
    transactions_total, transactions_month = counts(
        db.query(Workflow).filter(Workflow.status == WorkflowStatus.COMPLETED), Workflow.completed_at
    )

    roles_breakdown = [
        {"role": r, "count": c}
        for r, c in db.query(User.role, func.count(User.id)).filter(User.is_active == True).group_by(User.role).all()
    ]
    documents_by_type = [
        {"doc_type": t, "count": c}
        for t, c in db.query(Document.doc_type, func.count(Document.id)).group_by(Document.doc_type).all()
    ]

    # "Vérifications aujourd'hui" : dossiers KYC tranchés + workflows de vérification
    # (diplôme/emploi) finalisés aujourd'hui — les seuls événements de vérification
    # réellement journalisés dans ce backend (les appels GET /documents/verify/{id} ne le
    # sont pas, ce sont de simples lectures on-chain sans trace en base).
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_before_start = day_start - timedelta(days=1)
    verification_workflow_types = [WorkflowType.DIPLOMA_VERIFICATION, WorkflowType.EMPLOYMENT_VERIFICATION]

    def verifications_since(start: datetime, end: datetime) -> int:
        kyc_count = db.query(KycVerification).filter(
            KycVerification.reviewed_at >= start, KycVerification.reviewed_at < end
        ).count()
        workflow_count = db.query(Workflow).filter(
            Workflow.workflow_type.in_(verification_workflow_types),
            Workflow.status == WorkflowStatus.COMPLETED,
            Workflow.completed_at >= start, Workflow.completed_at < end,
        ).count()
        return kyc_count + workflow_count

    verifications_today = verifications_since(day_start, now)
    verifications_yesterday = verifications_since(day_before_start, day_start)
    if verifications_yesterday > 0:
        verifications_delta_pct = round((verifications_today - verifications_yesterday) / verifications_yesterday * 100, 1)
    else:
        verifications_delta_pct = None

    # "Statistiques de la plateforme" : nouveaux documents par jour sur les 90 derniers
    # jours — le frontend découpe cette même série pour les onglets 7/30/90 jours.
    ninety_days_ago = now - timedelta(days=90)
    recent_docs = db.query(Document).filter(Document.created_at >= ninety_days_ago).all()
    daily_counts = defaultdict(int)
    for d in recent_docs:
        daily_counts[d.created_at.date().isoformat()] += 1
    daily_activity = [
        {"date": (ninety_days_ago + timedelta(days=i)).date().isoformat(), "count": daily_counts.get((ninety_days_ago + timedelta(days=i)).date().isoformat(), 0)}
        for i in range(91)
    ]

    return {
        "actors_total": actors_total, "actors_delta_month": actors_month,
        "documents_total": documents_total, "documents_delta_month": documents_month,
        "land_titles_total": land_titles_total, "land_titles_delta_month": land_titles_month,
        "transactions_total": transactions_total, "transactions_delta_month": transactions_month,
        "roles_breakdown": roles_breakdown,
        "documents_by_type": documents_by_type,
        "verifications_today": verifications_today,
        "verifications_delta_pct": verifications_delta_pct,
        "daily_activity": daily_activity,
    }


def _issuer_overview(db: Session, current_user: dict, now: datetime) -> dict:
    month_start = _month_start(now)
    my_diplomas = db.query(Document).filter(
        Document.issuer == current_user["address"], Document.doc_type == "DIPLOMA"
    )
    diplomas_total = my_diplomas.count()
    diplomas_month = my_diplomas.filter(Document.created_at >= month_start).count()
    students_enrolled = db.query(func.count(func.distinct(Document.owner))).filter(
        Document.issuer == current_user["address"], Document.doc_type == "DIPLOMA"
    ).scalar()

    pending_requests = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.DIPLOMA_VERIFICATION,
        Workflow.status == WorkflowStatus.AWAITING_VERIFICATION,
    ).count()
    verifications_count = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.DIPLOMA_VERIFICATION,
        Workflow.status == WorkflowStatus.COMPLETED,
    ).count()

    months = _last_n_months(now, 6)
    six_months_ago = months[0]
    recent_diplomas = my_diplomas.filter(Document.created_at >= six_months_ago).all()
    monthly_issuance = _bucket_by_month([d.created_at for d in recent_diplomas], months)

    return {
        "diplomas_issued": diplomas_total, "diplomas_delta_month": diplomas_month,
        "pending_requests": pending_requests,
        "students_enrolled": students_enrolled or 0,
        "verifications_count": verifications_count,
        "monthly_issuance": monthly_issuance,
    }


def _verifier_overview(db: Session, current_user: dict, now: datetime) -> dict:
    month_start = _month_start(now)
    my_attestations = db.query(Document).filter(
        Document.issuer == current_user["address"], Document.doc_type == "EMPLOYMENT"
    )
    attestations_total = my_attestations.count()
    attestations_month = my_attestations.filter(Document.created_at >= month_start).count()
    employees_registered = db.query(func.count(func.distinct(Document.owner))).filter(
        Document.issuer == current_user["address"], Document.doc_type == "EMPLOYMENT"
    ).scalar()

    pending_requests = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.DIPLOMA_VERIFICATION,
        Workflow.status == WorkflowStatus.AWAITING_VERIFICATION,
    ).count()
    verifications_month = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.DIPLOMA_VERIFICATION,
        Workflow.status == WorkflowStatus.COMPLETED,
        Workflow.completed_at >= month_start,
    ).count()

    return {
        "verifications_month": verifications_month,
        "pending_requests": pending_requests,
        "attestations_issued": attestations_total, "attestations_delta_month": attestations_month,
        "employees_registered": employees_registered or 0,
    }


def _bank_overview(db: Session, current_user: dict, now: datetime) -> dict:
    month_start = _month_start(now)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    loan_workflows = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.LOAN_APPLICATION,
    )
    loan_requests_pending = loan_workflows.filter(Workflow.status == WorkflowStatus.AWAITING_VERIFICATION).count()
    loans_approved_month = loan_workflows.filter(
        Workflow.status == WorkflowStatus.COMPLETED, Workflow.completed_at >= month_start
    ).count()
    verifications_month = loan_workflows.filter(
        Workflow.status == WorkflowStatus.COMPLETED, Workflow.completed_at >= month_start
    ).count()
    clients_total = db.query(func.count(func.distinct(Workflow.initiator_id))).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.LOAN_APPLICATION,
    ).scalar()

    requests_by_status = [
        {"status": s.value, "count": c}
        for s, c in db.query(Workflow.status, func.count(Workflow.id)).filter(
            Workflow.target_user_id == current_user["id"],
            Workflow.workflow_type == WorkflowType.LOAN_APPLICATION,
        ).group_by(Workflow.status).all()
    ]

    def amount_sum(start: datetime, end: datetime) -> float:
        rows = loan_workflows.filter(Workflow.created_at >= start, Workflow.created_at < end).all()
        return sum(float((w.workflow_data or {}).get("amount") or 0) for w in rows)

    loan_amount_month = amount_sum(month_start, now)
    loan_amount_prev_month = amount_sum(prev_month_start, month_start)
    if loan_amount_prev_month > 0:
        loan_amount_delta_pct = round((loan_amount_month - loan_amount_prev_month) / loan_amount_prev_month * 100, 1)
    else:
        loan_amount_delta_pct = None

    kyc_pending = db.query(KycVerification).filter(KycVerification.status == KycStatus.PENDING).count()
    kyc_reviewed_month = db.query(KycVerification).filter(
        KycVerification.reviewed_by == current_user["id"], KycVerification.reviewed_at >= month_start
    ).count()
    clients_verified_total = db.query(KycVerification).filter(KycVerification.status == KycStatus.APPROVED).count()
    kyc_by_status = [
        {"status": s.value, "count": c}
        for s, c in db.query(KycVerification.status, func.count(KycVerification.id)).group_by(KycVerification.status).all()
    ]

    return {
        "loan_requests_pending": loan_requests_pending,
        "loans_approved_month": loans_approved_month,
        "verifications_month": verifications_month,
        "clients_total": clients_total or 0,
        "requests_by_status": requests_by_status,
        "loan_amount_month": loan_amount_month,
        "loan_amount_delta_pct": loan_amount_delta_pct,
        "kyc_pending": kyc_pending,
        "kyc_reviewed_month": kyc_reviewed_month,
        "clients_verified_total": clients_verified_total,
        "kyc_by_status": kyc_by_status,
    }


def _notary_overview(db: Session, current_user: dict, now: datetime) -> dict:
    month_start = _month_start(now)
    titles = db.query(Document).filter(Document.doc_type == "LAND_TITLE")
    titles_total = titles.count()
    titles_month = titles.filter(Document.created_at >= month_start).count()

    transfers = db.query(Workflow).filter(Workflow.workflow_type == WorkflowType.LAND_TRANSFER)
    transfers_in_progress = transfers.filter(
        Workflow.status.in_([WorkflowStatus.AWAITING_VERIFICATION, WorkflowStatus.AWAITING_NOTARY])
    ).count()
    transfers_completed = transfers.filter(Workflow.status == WorkflowStatus.COMPLETED)
    transfers_completed_total = transfers_completed.count()
    transfers_completed_month = transfers_completed.filter(Workflow.completed_at >= month_start).count()

    notarized_acts = db.query(Workflow).filter(
        Workflow.notary_id == current_user["id"], Workflow.status == WorkflowStatus.COMPLETED
    ).count()

    parties_verified_month = db.query(KycVerification).filter(
        KycVerification.reviewed_by == current_user["id"], KycVerification.reviewed_at >= month_start
    ).count()
    parties_by_status = [
        {"status": s.value, "count": c}
        for s, c in db.query(KycVerification.status, func.count(KycVerification.id)).group_by(KycVerification.status).all()
    ]

    location_counts: dict = {}
    for doc in titles.all():
        location = next((a.get("value") for a in (doc.attributes or []) if a.get("key") == "location"), None)
        if location:
            location_counts[location] = location_counts.get(location, 0) + 1
    titles_by_location = [{"location": loc, "count": c} for loc, c in sorted(location_counts.items(), key=lambda x: -x[1])][:5]

    return {
        "titles_registered": titles_total, "titles_delta_month": titles_month,
        "transfers_in_progress": transfers_in_progress,
        "transfers_completed": transfers_completed_total, "transfers_delta_month": transfers_completed_month,
        "notarized_acts": notarized_acts,
        "parties_verified_month": parties_verified_month,
        "parties_by_status": parties_by_status,
        "titles_by_location": titles_by_location,
    }


def _user_overview(db: Session, current_user: dict) -> dict:
    my_documents_total = db.query(Document).filter(Document.owner == current_user["address"]).count()
    requests_pending = db.query(Workflow).filter(
        Workflow.initiator_id == current_user["id"],
        Workflow.status.in_([WorkflowStatus.PENDING, WorkflowStatus.IN_PROGRESS, WorkflowStatus.AWAITING_VERIFICATION]),
    ).count()
    offers_received = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.LAND_TRANSFER,
        Workflow.status == WorkflowStatus.AWAITING_VERIFICATION,
    ).count()
    documents_verified_total = db.query(Workflow).filter(
        Workflow.initiator_id == current_user["id"],
        Workflow.status == WorkflowStatus.COMPLETED,
    ).count()

    return {
        "my_documents_total": my_documents_total,
        "requests_pending": requests_pending,
        "offers_received": offers_received,
        "documents_verified_total": documents_verified_total,
    }


_DOC_LABELS = {"LAND_TITLE": "Titre foncier", "DIPLOMA": "Diplôme", "EMPLOYMENT": "Attestation d'emploi",
               "ID_CARD": "Carte d'identité", "BIRTH_CERTIFICATE": "Acte de naissance",
               "RESIDENCE_CERTIFICATE": "Attestation de résidence"}
_WORKFLOW_LABELS = {
    WorkflowType.LAND_TRANSFER: "Transfert de propriété finalisé",
    WorkflowType.DIPLOMA_VERIFICATION: "Vérification de diplôme finalisée",
    WorkflowType.LOAN_APPLICATION: "Demande de prêt finalisée",
    WorkflowType.EMPLOYMENT_VERIFICATION: "Vérification d'emploi finalisée",
    WorkflowType.ID_CARD_ISSUANCE: "Émission de carte d'identité finalisée",
}


def _names_by_address(db: Session, addresses: set) -> dict:
    addresses.discard(None)
    if not addresses:
        return {}
    return {u.address: u.full_name for u in db.query(User).filter(User.address.in_(addresses)).all()}


@router.get("/stats/activity")
def get_recent_activity(
    limit: int = 8,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fil d'activité récente, scopé au rôle de l'appelant (l'ADMIN seul a une vue
    transverse sur toute la plateforme)."""
    role = current_user["role"]
    if role == "ADMIN":
        events = _admin_activity(db, limit)
    elif role == "ISSUER":
        events = _issuer_activity(db, current_user, limit)
    elif role == "VERIFIER":
        events = _verifier_activity(db, current_user, limit)
    elif role == "BANK":
        events = _bank_activity(db, current_user, limit)
    elif role == "NOTARY":
        events = _notary_activity(db, current_user, limit)
    else:
        events = _user_activity(db, current_user, limit)

    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events[:limit]


def _admin_activity(db: Session, limit: int) -> list:
    events = []
    recent_docs = db.query(Document).order_by(Document.created_at.desc()).limit(limit).all()
    issuer_names = _names_by_address(db, {d.issuer for d in recent_docs})
    for d in recent_docs:
        label = _DOC_LABELS.get(d.doc_type, d.doc_type)
        issuer_name = issuer_names.get(d.issuer, d.issuer)
        events.append({
            "type": "document_issued",
            "message": f"{label} émis par {issuer_name}" if issuer_name else f"{label} enregistré",
            "timestamp": d.created_at,
        })

    recent_actors = db.query(User).filter(User.created_by.isnot(None)).order_by(User.created_at.desc()).limit(limit).all()
    for u in recent_actors:
        events.append({"type": "actor_created", "message": f"Nouvel acteur créé : {u.full_name}", "timestamp": u.created_at})

    recent_completions = db.query(Workflow).filter(
        Workflow.status == WorkflowStatus.COMPLETED, Workflow.completed_at.isnot(None)
    ).order_by(Workflow.completed_at.desc()).limit(limit).all()
    for w in recent_completions:
        events.append({
            "type": "workflow_completed",
            "message": _WORKFLOW_LABELS.get(w.workflow_type, "Démarche finalisée"),
            "timestamp": w.completed_at,
        })
    return events


def _issuer_activity(db: Session, current_user: dict, limit: int) -> list:
    events = []
    my_docs = db.query(Document).filter(Document.issuer == current_user["address"]).order_by(
        Document.created_at.desc()
    ).limit(limit).all()
    for d in my_docs:
        events.append({
            "type": "document_issued",
            "message": f"{_DOC_LABELS.get(d.doc_type, d.doc_type)} émis ({d.doc_key})",
            "timestamp": d.created_at,
        })
    completions = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.DIPLOMA_VERIFICATION,
        Workflow.status == WorkflowStatus.COMPLETED,
    ).order_by(Workflow.completed_at.desc()).limit(limit).all()
    for w in completions:
        events.append({"type": "workflow_completed", "message": "Vérification de diplôme finalisée", "timestamp": w.completed_at})
    return events


def _verifier_activity(db: Session, current_user: dict, limit: int) -> list:
    events = []
    my_docs = db.query(Document).filter(Document.issuer == current_user["address"]).order_by(
        Document.created_at.desc()
    ).limit(limit).all()
    for d in my_docs:
        events.append({
            "type": "document_issued",
            "message": f"{_DOC_LABELS.get(d.doc_type, d.doc_type)} émise ({d.doc_key})",
            "timestamp": d.created_at,
        })
    completions = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.status == WorkflowStatus.COMPLETED,
    ).order_by(Workflow.completed_at.desc()).limit(limit).all()
    for w in completions:
        events.append({"type": "workflow_completed", "message": _WORKFLOW_LABELS.get(w.workflow_type, "Démarche finalisée"), "timestamp": w.completed_at})
    return events


def _bank_activity(db: Session, current_user: dict, limit: int) -> list:
    events = []
    reviewed = db.query(KycVerification).filter(
        KycVerification.reviewed_by == current_user["id"]
    ).order_by(KycVerification.reviewed_at.desc()).limit(limit).all()
    for k in reviewed:
        verdict = "approuvé" if k.status == KycStatus.APPROVED else "rejeté"
        events.append({"type": "kyc_reviewed", "message": f"Dossier KYC de {k.full_name} {verdict}", "timestamp": k.reviewed_at})
    completions = db.query(Workflow).filter(
        Workflow.target_user_id == current_user["id"],
        Workflow.workflow_type == WorkflowType.LOAN_APPLICATION,
        Workflow.status == WorkflowStatus.COMPLETED,
    ).order_by(Workflow.completed_at.desc()).limit(limit).all()
    for w in completions:
        events.append({"type": "workflow_completed", "message": "Demande de prêt finalisée", "timestamp": w.completed_at})
    return events


def _notary_activity(db: Session, current_user: dict, limit: int) -> list:
    events = []
    completions = db.query(Workflow).filter(
        Workflow.notary_id == current_user["id"], Workflow.status == WorkflowStatus.COMPLETED
    ).order_by(Workflow.completed_at.desc()).limit(limit).all()
    for w in completions:
        events.append({"type": "workflow_completed", "message": "Transfert de titre finalisé", "timestamp": w.completed_at})
    reviewed = db.query(KycVerification).filter(
        KycVerification.reviewed_by == current_user["id"]
    ).order_by(KycVerification.reviewed_at.desc()).limit(limit).all()
    for k in reviewed:
        verdict = "approuvé" if k.status == KycStatus.APPROVED else "rejeté"
        events.append({"type": "kyc_reviewed", "message": f"Dossier KYC de {k.full_name} {verdict}", "timestamp": k.reviewed_at})
    return events


def _user_activity(db: Session, current_user: dict, limit: int) -> list:
    events = []
    my_docs = db.query(Document).filter(Document.owner == current_user["address"]).order_by(
        Document.created_at.desc()
    ).limit(limit).all()
    for d in my_docs:
        events.append({
            "type": "document_received",
            "message": f"{_DOC_LABELS.get(d.doc_type, d.doc_type)} reçu",
            "timestamp": d.created_at,
        })
    completions = db.query(Workflow).filter(
        Workflow.initiator_id == current_user["id"], Workflow.status == WorkflowStatus.COMPLETED
    ).order_by(Workflow.completed_at.desc()).limit(limit).all()
    for w in completions:
        events.append({"type": "workflow_completed", "message": _WORKFLOW_LABELS.get(w.workflow_type, "Démarche finalisée"), "timestamp": w.completed_at})
    return events


@router.get("/network/status")
def get_network_status(admin: dict = Depends(get_current_admin)):
    connected = blockchain_client.w3.is_connected()
    return {
        "connected": connected,
        "block_number": blockchain_client.w3.eth.block_number if connected else None,
        "chain_id": blockchain_client.w3.eth.chain_id if connected else None,
        "contract_address": blockchain_client.contract_address,
    }
