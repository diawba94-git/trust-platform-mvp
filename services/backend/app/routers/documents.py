from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Document
from ..schemas import DocumentHistoryResponse
from ..auth import get_current_user
from ..blockchain import BlockchainClient
from ..ipfs_utils import IPFSClient

router = APIRouter(prefix="/documents", tags=["Documents"])

blockchain_client = BlockchainClient()
ipfs_client = IPFSClient()


@router.get("/issued")
async def get_issued_documents(
    doc_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Documents émis, du point de vue de l'émetteur (symétrique de /documents/my qui est
    scopé propriétaire). ADMIN et NOTARY voient tout le registre (pas de filtre émetteur) :
    l'État supervise l'ensemble des titres fonciers, pas seulement ceux qu'il a lui-même
    enregistrés. Les autres rôles ne voient que ce qu'ils ont personnellement émis."""
    query = db.query(Document)
    if current_user["role"] not in ("ADMIN", "NOTARY"):
        query = query.filter(Document.issuer == current_user["address"])
    if doc_type:
        query = query.filter(Document.doc_type == doc_type)
    documents = query.order_by(Document.created_at.desc()).limit(50).all()

    addresses = {d.issuer for d in documents} | {d.owner for d in documents}
    names_by_address = {
        u.address: u.full_name for u in db.query(User).filter(User.address.in_(addresses)).all()
    } if addresses else {}

    return [
        {
            "token_id": d.token_id,
            "doc_type": d.doc_type,
            "doc_key": d.doc_key,
            "issuer": names_by_address.get(d.issuer, d.issuer),
            "owner": names_by_address.get(d.owner, d.owner),
            "is_active": d.is_active,
            "is_transferable": d.is_transferable,
            "created_at": d.created_at,
        }
        for d in documents
    ]


@router.post("/{token_id}/verify-file")
async def verify_file(
    token_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Détecte une falsification : calcule le CID IPFS du fichier fourni (sans le stocker)
    et le compare au CID actuellement enregistré on-chain pour ce document."""
    doc = blockchain_client.verify_document(token_id)
    if not doc['isValid']:
        raise HTTPException(status_code=404, detail="Document not found")

    content = await file.read()
    computed_cid = ipfs_client.compute_cid(content, file.filename)
    onchain_cid = doc['ipfsCid']

    return {
        "match": computed_cid == onchain_cid,
        "computed_cid": computed_cid,
        "onchain_cid": onchain_cid,
    }


@router.post("/verify-file")
async def verify_file_auto(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Vérifie un document à partir du seul fichier déposé, sans Token ID à saisir : son
    empreinte IPFS identifie directement le document via le mapping on-chain hashToTokenId
    (le même que celui qui interdit au contrat la réémission d'un fichier déjà connu à
    l'émission) — pas besoin de lire un QR, le contenu du fichier fait foi."""
    content = await file.read()
    computed_cid = ipfs_client.compute_cid(content, file.filename)
    token_id = blockchain_client.get_token_id_by_cid(computed_cid)
    if not token_id:
        raise HTTPException(status_code=404, detail="Ce fichier ne correspond à aucun document connu sur TrustWedge")

    doc = blockchain_client.verify_document(token_id)
    owner_user = db.query(User).filter(User.address == doc["owner"]).first()
    issuer_user = db.query(User).filter(User.address == doc["issuer"]).first()
    doc["owner_name"] = owner_user.full_name if owner_user else None
    doc["issuer_name"] = issuer_user.full_name if issuer_user else None
    doc["token_id"] = token_id
    doc["computed_cid"] = computed_cid
    doc["match"] = True

    return doc


@router.get("/download/{cid}")
async def download_document(
    cid: str,
    current_user: dict = Depends(get_current_user)
):
    """Télécharge le fichier (PDF) associé à un CID IPFS."""
    content = ipfs_client.get_file(cid)
    return Response(content=content, media_type="application/pdf")


@router.get("/{token_id}/versions", response_model=DocumentHistoryResponse)
async def get_document_versions(
    token_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Historique complet des versions (fichier + propriétaire) d'un document, lu on-chain."""
    doc = blockchain_client.verify_document(token_id)
    if not doc['isValid']:
        raise HTTPException(status_code=404, detail="Document not found")

    versions = blockchain_client.get_document_versions(token_id)

    enriched_versions = []
    for i, v in enumerate(versions):
        owner_user = db.query(User).filter(User.address == v['owner']).first()
        enriched_versions.append({
            "version_index": i,
            "cid": v['cid'],
            "owner": v['owner'],
            "owner_name": owner_user.full_name if owner_user else "Inconnu",
            "timestamp": v['timestamp'],
            "is_current": i == len(versions) - 1
        })

    current_owner_user = db.query(User).filter(User.address == doc['owner']).first()
    local_document = db.query(Document).filter(Document.token_id == token_id).first()

    return {
        "token_id": token_id,
        "doc_type": doc['docType'],
        "doc_key": local_document.doc_key if local_document else None,
        "current_owner": doc['owner'],
        "current_owner_name": current_owner_user.full_name if current_owner_user else None,
        "current_owner_did": current_owner_user.did if current_owner_user else f"did:ethr:{doc['owner']}",
        "is_active": local_document.is_active if local_document else True,
        "is_transferable": local_document.is_transferable if local_document else False,
        "attributes": local_document.attributes if local_document else [],
        "versions": enriched_versions
    }


@router.get("/{token_id}/owner-at")
async def get_owner_at_timestamp(
    token_id: int,
    timestamp: int,
    current_user: dict = Depends(get_current_user)
):
    """Retrouve le propriétaire d'un document à un instant donné (timestamp Unix)."""
    owner = blockchain_client.get_owner_at_timestamp(token_id, timestamp)
    return {"token_id": token_id, "timestamp": timestamp, "owner": owner}
