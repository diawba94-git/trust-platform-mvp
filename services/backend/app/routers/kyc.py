from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import KycVerification, KycStatus, User
from ..schemas import KycSubmitRequest, KycOut, KycReviewRequest
from ..auth import get_current_user

router = APIRouter(prefix="/verification/kyc", tags=["KYC"])

# Rôles habilités à revoir une demande KYC (Banque et Notaire, cf. maquettes "Demandes KYC
# récentes" / "Vérifications"). Contrairement à routers/verification.py (étapes techniques
# OTP/OCR/face-match, volontairement sans état), ce routeur persiste le dossier complet pour
# permettre une vraie revue humaine.
_REVIEWER_ROLES = {"BANK", "NOTARY"}


def _to_out(k: KycVerification) -> dict:
    return {
        "id": k.id,
        "user_id": k.user_id,
        "full_name": k.full_name,
        "id_card_number": k.id_card_number,
        "phone_verified": k.phone_verified,
        "email_verified": k.email_verified,
        "face_match_passed": k.face_match_passed,
        "status": k.status.value,
        "reviewer_notes": k.reviewer_notes,
        "created_at": k.created_at,
        "reviewed_at": k.reviewed_at,
    }


@router.post("/submit", response_model=KycOut)
def submit_kyc(
    request: KycSubmitRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Appelé par le wallet mobile à l'issue de son parcours KYC (OTP + OCR + face-match),
    une fois par utilisateur — crée le dossier à revoir par Banque/Notaire."""
    record = KycVerification(
        user_id=current_user["id"],
        full_name=request.full_name,
        id_card_number=request.id_card_number,
        id_card_data=request.id_card_data,
        phone_verified=request.phone_verified,
        email_verified=request.email_verified,
        face_match_passed=request.face_match_passed,
        status=KycStatus.PENDING,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _to_out(record)


@router.get("/pending", response_model=list[KycOut])
def list_pending_kyc(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] not in _REVIEWER_ROLES:
        raise HTTPException(status_code=403, detail="Réservé à la banque et au notaire")

    query = db.query(KycVerification)
    if status:
        query = query.filter(KycVerification.status == KycStatus[status])
    else:
        query = query.filter(KycVerification.status == KycStatus.PENDING)
    records = query.order_by(KycVerification.created_at.desc()).all()
    return [_to_out(k) for k in records]


@router.get("/mine", response_model=Optional[KycOut])
def my_kyc_status(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(KycVerification)
        .filter(KycVerification.user_id == current_user["id"])
        .order_by(KycVerification.created_at.desc())
        .first()
    )
    return _to_out(record) if record else None


@router.post("/{kyc_id}/review", response_model=KycOut)
def review_kyc(
    kyc_id: int,
    request: KycReviewRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user["role"] not in _REVIEWER_ROLES:
        raise HTTPException(status_code=403, detail="Réservé à la banque et au notaire")

    record = db.query(KycVerification).filter(KycVerification.id == kyc_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dossier KYC introuvable")
    if record.status != KycStatus.PENDING:
        raise HTTPException(status_code=400, detail="Ce dossier a déjà été traité")

    record.status = KycStatus.APPROVED if request.approve else KycStatus.REJECTED
    record.reviewed_by = current_user["id"]
    record.reviewer_notes = request.notes
    record.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return _to_out(record)
