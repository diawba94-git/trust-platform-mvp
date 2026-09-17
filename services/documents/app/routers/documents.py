from typing import Optional
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from trustwedge_auth import get_current_user

from ..database import get_db
from ..models import Document
from ..schemas import DocumentCreate
from ..workflow_engine import WorkflowEngine
from ..blockchain import BlockchainClient
from ..services.did_service import DIDService
from .. import storage_client

router = APIRouter(tags=["Documents"])

blockchain_client = BlockchainClient()
did_service = DIDService(os.getenv("ENCRYPTION_KEY"))


@router.post("/documents/issue")
async def issue_document(
    doc: DocumentCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, did_service)
    return await engine.issue_document_with_workflow(doc, current_user)


@router.get("/documents/my")
def get_my_documents(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    documents = db.query(Document).filter(Document.owner == current_user["address"]).order_by(Document.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "token_id": d.token_id,
            "issuer": d.issuer,
            "issuer_address": d.issuer,
            "owner": d.owner,
            "doc_type": d.doc_type,
            "doc_key": d.doc_key,
            "ipfs_cid": d.ipfs_cid,
            "is_active": d.is_active,
            "is_transferable": d.is_transferable,
            "attributes": d.attributes,
            "created_at": d.created_at,
        } for d in documents
    ]


@router.get("/documents/issued")
async def get_issued_documents(
    doc_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Documents émis, du point de vue de l'émetteur. ADMIN et NOTARY voient tout le
    registre ; les autres rôles ne voient que ce qu'ils ont personnellement émis."""
    query = db.query(Document)
    if current_user["role"] not in ("ADMIN", "NOTARY"):
        query = query.filter(Document.issuer == current_user["address"])
    if doc_type:
        query = query.filter(Document.doc_type == doc_type)
    documents = query.order_by(Document.created_at.desc()).limit(50).all()

    return [
        {
            "token_id": d.token_id,
            "doc_type": d.doc_type,
            "doc_key": d.doc_key,
            "issuer": d.issuer,
            "owner": d.owner,
            "is_active": d.is_active,
            "is_transferable": d.is_transferable,
            "created_at": d.created_at,
        }
        for d in documents
    ]


@router.get("/documents/download/{cid}")
async def download_document(cid: str, current_user: dict = Depends(get_current_user)):
    """Télécharge le fichier (PDF) associé à un CID IPFS, via le module storage."""
    from fastapi import Response
    content = storage_client.get_file(cid)
    return Response(content=content, media_type="application/pdf")
