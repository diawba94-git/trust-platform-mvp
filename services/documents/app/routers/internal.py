"""Endpoints internes (réseau Docker uniquement, non routés par Kong)."""
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document
from ..schemas import IssueIdCardInternalRequest
from ..workflow_engine import WorkflowEngine
from ..blockchain import BlockchainClient
from ..services.did_service import DIDService

router = APIRouter(prefix="/internal/documents", tags=["Internal"])

blockchain_client = BlockchainClient()
did_service = DIDService(os.getenv("ENCRYPTION_KEY"))


@router.post("/issue-id-card")
async def issue_id_card_internal(request: IssueIdCardInternalRequest, db: Session = Depends(get_db)):
    """Appelé par le module identity juste après la création d'un DID avec identité civile
    (cf. identity/app/documents_client.py) — pas de revérification de rôle ici, créer le DID
    a déjà implicitement autorisé cette émission (même règle que l'ancien monolithe)."""
    engine = WorkflowEngine(db, blockchain_client, did_service)
    issuer = {"id": request.issuer_id, "role": request.issuer_role, "address": request.issuer_address}
    return await engine.issue_id_card(
        owner_did=request.owner_did, issuer=issuer,
        first_name=request.first_name, last_name=request.last_name,
        date_of_birth=request.date_of_birth, place_of_birth=request.place_of_birth,
        national_id_number=request.national_id_number,
    )


@router.post("/{token_id}/mark-transferred")
def mark_transferred(token_id: int, new_owner: str, new_cid: str, db: Session = Depends(get_db)):
    """Met à jour le miroir local (`Document.owner`/`ipfs_cid`) après un transfert finalisé
    on-chain par le module exchange — exchange ne touche plus directement la table Document."""
    document = db.query(Document).filter(Document.token_id == token_id).first()
    if not document:
        return {"found": False}
    document.owner = new_owner
    document.ipfs_cid = new_cid
    db.commit()
    return {"found": True}


@router.get("/{token_id}/status")
def document_status(token_id: int, db: Session = Depends(get_db)):
    """Appelé par le module exchange avant d'autoriser un transfert/partage — évite qu'il
    n'accède directement à la table Document, dont ce module reste seul propriétaire en
    écriture pour la mise en vente/transfert (le statut on-chain réel reste vérifié par
    exchange lui-même via le contrat, cette route ne fait que refléter le miroir local)."""
    document = db.query(Document).filter(Document.token_id == token_id).first()
    if not document:
        return {"found": False}
    return {
        "found": True,
        "owner": document.owner,
        "is_active": document.is_active,
        "is_transferable": document.is_transferable,
        "doc_type": document.doc_type,
        "doc_key": document.doc_key,
        "attributes": document.attributes,
    }
