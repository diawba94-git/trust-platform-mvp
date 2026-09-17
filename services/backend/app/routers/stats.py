"""Statistiques agrégées — documents émis/vérifiés et fil d'activité récente. Toutes les
valeurs sont calculées à la volée depuis Postgres — rien n'est mis en cache ni précalculé,
le volume de données de cette plateforme ne le justifie pas."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, User, Workflow, WorkflowStatus, WorkflowType
from trustwedge_auth import get_current_user
from ..blockchain import BlockchainClient

router = APIRouter(tags=["Stats"])

blockchain_client = BlockchainClient()


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get("/stats/overview")
def get_stats_overview(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Statistiques globales sur les documents émis/vérifiés — plus de répartition par
    tableau de bord de rôle (remplacés par la Console technique, commune à tous les rôles)."""
    now = datetime.now(timezone.utc)
    month_start = _month_start(now)

    documents_total = db.query(Document).count()
    documents_month = db.query(Document).filter(Document.created_at >= month_start).count()
    documents_by_type = [
        {"doc_type": t, "count": c}
        for t, c in db.query(Document.doc_type, func.count(Document.id)).group_by(Document.doc_type).all()
    ]

    documents_verified_total = db.query(Workflow).filter(Workflow.status == WorkflowStatus.COMPLETED).count()
    documents_verified_month = db.query(Workflow).filter(
        Workflow.status == WorkflowStatus.COMPLETED, Workflow.completed_at >= month_start
    ).count()

    return {
        "documents_total": documents_total, "documents_delta_month": documents_month,
        "documents_by_type": documents_by_type,
        "documents_verified_total": documents_verified_total,
        "documents_verified_delta_month": documents_verified_month,
    }


_DOC_LABELS = {"LAND_TITLE": "Titre foncier", "DIPLOMA": "Diplôme", "EMPLOYMENT": "Attestation d'emploi",
               "ID_CARD": "Carte d'identité", "BIRTH_CERTIFICATE": "Acte de naissance",
               "RESIDENCE_CERTIFICATE": "Attestation de résidence"}
_WORKFLOW_LABELS = {
    WorkflowType.LAND_TRANSFER: "Transfert de propriété finalisé",
    WorkflowType.LOAN_APPLICATION: "Demande de prêt finalisée",
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
def get_network_status(current_user: dict = Depends(get_current_user)):
    """État du réseau blockchain — lecture technique sans donnée sensible, exposée à tout
    acteur authentifié (section "API & intégrations" de la Console technique)."""
    connected = blockchain_client.w3.is_connected()
    return {
        "connected": connected,
        "block_number": blockchain_client.w3.eth.block_number if connected else None,
        "chain_id": blockchain_client.w3.eth.chain_id if connected else None,
        "contract_address": blockchain_client.contract_address,
    }
