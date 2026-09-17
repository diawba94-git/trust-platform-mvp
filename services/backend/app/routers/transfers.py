from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import os

from ..database import get_db
from ..models import User, Document, Workflow, WorkflowStatus, WorkflowType
from ..schemas import TransferInitiateRequest, TransferAcceptRequest, TransferFinalizeRequest
from ..auth import get_current_user
from ..blockchain import BlockchainClient
from ..ipfs_utils import IPFSClient
from ..services.did_service import DIDService
from ..services.pdf_generator import generate_land_title_pdf
from ..services.notification_service import notify
from ..shared import event_bus

router = APIRouter(prefix="/workflows/transfer", tags=["Transfer"])

blockchain_client = BlockchainClient()
ipfs_client = IPFSClient()
did_service = DIDService(os.getenv("ENCRYPTION_KEY"))


def _get_private_key_or_400(user_id: int, db: Session, who: str) -> str:
    key = did_service.get_private_key(user_id, db)
    if not key:
        raise HTTPException(status_code=400, detail=f"Aucune clé privée enregistrée pour {who}")
    return key


@router.post("/initiate")
async def initiate_transfer(
    request: TransferInitiateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    👤 VENDEUR - Met en vente un titre foncier qu'il possède, signé de sa clé privée.
    """
    document = db.query(Document).filter(Document.token_id == request.token_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.owner != current_user["address"]:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le propriétaire de ce document")
    if not document.is_transferable:
        raise HTTPException(status_code=400, detail="Ce document n'est pas transférable")

    buyer = db.query(User).filter(User.email == request.buyer_email, User.is_active == True).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Acheteur introuvable (email non enregistré)")
    if buyer.address == current_user["address"]:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous vendre le titre à vous-même")

    seller_key = _get_private_key_or_400(current_user["id"], db, "le vendeur")
    result = blockchain_client.initiate_transfer(request.token_id, buyer.address, seller_key)

    workflow = Workflow(
        workflow_type=WorkflowType.LAND_TRANSFER,
        status=WorkflowStatus.AWAITING_VERIFICATION,  # en attente de la signature de l'acheteur
        initiator_id=current_user["id"],
        target_user_id=buyer.id,
        document_token_id=request.token_id,
        seller_signature=result["signature"],
        workflow_data={
            "seller_address": current_user["address"],
            "buyer_address": buyer.address,
            "tx_hash_initiate": result["txHash"],
        },
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    await notify(
        db, event_bus, buyer.id,
        type="transfer_request",
        message=f"{current_user['email']} vous propose d'acheter le titre foncier #{request.token_id}",
        workflow_id=workflow.id,
        token_id=request.token_id,
    )

    return {"workflow_id": workflow.id, "status": workflow.status.value, "tx_hash": result["txHash"]}


@router.post("/accept")
async def accept_transfer(
    request: TransferAcceptRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    👤 ACHETEUR - Accepte l'offre et signe à son tour.
    """
    workflow = db.query(Workflow).filter(Workflow.id == request.workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if workflow.workflow_type != WorkflowType.LAND_TRANSFER:
        raise HTTPException(status_code=400, detail="Ce workflow n'est pas un transfert de titre foncier")
    if workflow.target_user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas l'acheteur désigné pour cette offre")
    if workflow.status != WorkflowStatus.AWAITING_VERIFICATION:
        raise HTTPException(status_code=400, detail="Cette offre n'est pas en attente de votre signature")

    buyer_address = workflow.workflow_data["buyer_address"]
    buyer_key = _get_private_key_or_400(current_user["id"], db, "l'acheteur")
    result = blockchain_client.accept_transfer(workflow.document_token_id, buyer_address, buyer_key)

    notary = db.query(User).filter(User.role == "NOTARY", User.is_active == True).first()
    if not notary:
        raise HTTPException(status_code=400, detail="Aucun notaire disponible pour finaliser le transfert")

    workflow.buyer_signature = result["signature"]
    workflow.status = WorkflowStatus.AWAITING_NOTARY
    workflow.notary_id = notary.id
    workflow.workflow_data = {**(workflow.workflow_data or {}), "tx_hash_accept": result["txHash"]}
    db.commit()

    seller = db.query(User).filter(User.id == workflow.initiator_id).first()

    await notify(
        db, event_bus, notary.id,
        type="notary_requested",
        message=f"Transfert du titre #{workflow.document_token_id} à valider ({seller.email if seller else '?'} → {current_user['email']})",
        workflow_id=workflow.id,
        token_id=workflow.document_token_id,
    )
    if seller:
        await notify(
            db, event_bus, seller.id,
            type="transfer_accepted",
            message=f"{current_user['email']} a accepté votre offre pour le titre #{workflow.document_token_id}",
            workflow_id=workflow.id,
            token_id=workflow.document_token_id,
        )

    return {"workflow_id": workflow.id, "status": workflow.status.value, "tx_hash": result["txHash"]}


@router.post("/notary-finalize")
async def notary_finalize_transfer(
    request: TransferFinalizeRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    🏛️ NOTAIRE - Signe et finalise : transfert de propriété exécuté on-chain,
    nouveau titre PDF régénéré au nom de l'acheteur et publié sur IPFS.
    """
    if current_user["role"] != "NOTARY":
        raise HTTPException(status_code=403, detail="Réservé aux notaires")

    workflow = db.query(Workflow).filter(Workflow.id == request.workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if workflow.workflow_type != WorkflowType.LAND_TRANSFER:
        raise HTTPException(status_code=400, detail="Ce workflow n'est pas un transfert de titre foncier")
    if workflow.notary_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le notaire désigné pour ce transfert")
    if workflow.status != WorkflowStatus.AWAITING_NOTARY:
        raise HTTPException(status_code=400, detail="Ce transfert n'est pas en attente de finalisation")

    document = db.query(Document).filter(Document.token_id == workflow.document_token_id).first()
    buyer = db.query(User).filter(User.id == workflow.target_user_id).first()
    if not document or not buyer:
        raise HTTPException(status_code=404, detail="Document ou acheteur introuvable")

    notary_key = _get_private_key_or_400(current_user["id"], db, "le notaire")
    buyer_address = workflow.workflow_data["buyer_address"]

    # Le nouveau PDF (au nom de l'acheteur) est publié sur IPFS avant la finalisation :
    # le contrat exécute transfert de propriété + nouvelle version en une seule transaction.
    attrs = {a["key"]: a["value"] for a in (document.attributes or [])}
    pdf_bytes = generate_land_title_pdf(
        owner_name=buyer.full_name,
        owner_did=buyer.did,
        token_id=document.token_id,
        location=attrs.get("location", "Non spécifié"),
        area=attrs.get("landArea", "0"),
        value=attrs.get("value", "0"),
        doc_key=document.doc_key,
    )
    new_cid = ipfs_client.upload_and_pin(pdf_bytes, f"land_title_{document.token_id}.pdf")

    transfer_result = blockchain_client.finalize_transfer(
        workflow.document_token_id, buyer_address, new_cid, notary_key
    )

    document.owner = buyer.address
    document.ipfs_cid = new_cid

    workflow.notary_signature = transfer_result["signature"]
    workflow.status = WorkflowStatus.COMPLETED
    workflow.transaction_hash = transfer_result["txHash"]
    workflow.completed_at = datetime.utcnow()
    workflow.workflow_data = {
        **(workflow.workflow_data or {}),
        "notary_notes": request.notes,
        "new_cid": new_cid,
    }
    db.commit()

    seller = db.query(User).filter(User.id == workflow.initiator_id).first()
    for party in filter(None, [seller, buyer]):
        await notify(
            db, event_bus, party.id,
            type="transfer_completed",
            message=f"Le transfert du titre #{document.token_id} a été finalisé par le notaire",
            workflow_id=workflow.id,
            token_id=document.token_id,
        )

    return {
        "status": "completed",
        "new_cid": new_cid,
        "tx_hash": transfer_result["txHash"],
    }
