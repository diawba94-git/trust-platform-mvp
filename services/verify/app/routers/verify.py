from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from trustwedge_auth import get_current_user

from ..database import get_db
from ..models import Document
from ..schemas import DocumentHistoryResponse
from ..blockchain import BlockchainClient
from .. import storage_client
from .. import identity_client

router = APIRouter(tags=["Verify"])

blockchain_client = BlockchainClient()


@router.get("/documents/verify/{token_id}")
def verify_document(token_id: int):
    """Public, sans authentification — c'est la source de vérité pour la vérification.
    Lecture blockchain uniquement (web3.py en mode call()), aucune clé de signature."""
    result = blockchain_client.verify_document(token_id)
    names = identity_client.resolve_by_address([result.get("owner"), result.get("issuer")])
    owner = names.get(result.get("owner"))
    issuer = names.get(result.get("issuer"))
    result["owner_name"] = owner["full_name"] if owner else None
    result["issuer_name"] = issuer["full_name"] if issuer else None
    return result


@router.post("/documents/{token_id}/verify-file")
async def verify_file(token_id: int, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Détecte une falsification : calcule le CID IPFS du fichier fourni (sans le stocker)
    et le compare au CID actuellement enregistré on-chain pour ce document."""
    doc = blockchain_client.verify_document(token_id)
    if not doc['isValid']:
        raise HTTPException(status_code=404, detail="Document not found")

    content = await file.read()
    computed_cid = storage_client.hash_only(content, file.filename or "file")
    onchain_cid = doc['ipfsCid']

    return {
        "match": computed_cid == onchain_cid,
        "computed_cid": computed_cid,
        "onchain_cid": onchain_cid,
    }


@router.post("/documents/verify-file")
async def verify_file_auto(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Vérifie un document à partir du seul fichier déposé, sans Token ID à saisir."""
    content = await file.read()
    computed_cid = storage_client.hash_only(content, file.filename or "file")
    token_id = blockchain_client.get_token_id_by_cid(computed_cid)
    if not token_id:
        raise HTTPException(status_code=404, detail="Ce fichier ne correspond à aucun document connu sur TrustWedge")

    doc = blockchain_client.verify_document(token_id)
    names = identity_client.resolve_by_address([doc.get("owner"), doc.get("issuer")])
    owner = names.get(doc.get("owner"))
    issuer = names.get(doc.get("issuer"))
    doc["owner_name"] = owner["full_name"] if owner else None
    doc["issuer_name"] = issuer["full_name"] if issuer else None
    doc["token_id"] = token_id
    doc["computed_cid"] = computed_cid
    doc["match"] = True

    return doc


@router.get("/documents/{token_id}/versions", response_model=DocumentHistoryResponse)
async def get_document_versions(token_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Historique complet des versions (fichier + propriétaire) d'un document, lu on-chain."""
    doc = blockchain_client.verify_document(token_id)
    if not doc['isValid']:
        raise HTTPException(status_code=404, detail="Document not found")

    versions = blockchain_client.get_document_versions(token_id)

    version_owners = {v["owner"] for v in versions} | {doc["owner"]}
    names = identity_client.resolve_by_address(list(version_owners))

    enriched_versions = []
    for i, v in enumerate(versions):
        owner_identity = names.get(v['owner'])
        enriched_versions.append({
            "version_index": i,
            "cid": v['cid'],
            "owner": v['owner'],
            "owner_name": owner_identity["full_name"] if owner_identity else "Inconnu",
            "timestamp": v['timestamp'],
            "is_current": i == len(versions) - 1
        })

    current_owner_identity = names.get(doc['owner'])
    local_document = db.query(Document).filter(Document.token_id == token_id).first()

    return {
        "token_id": token_id,
        "doc_type": doc['docType'],
        "doc_key": local_document.doc_key if local_document else None,
        "current_owner": doc['owner'],
        "current_owner_name": current_owner_identity["full_name"] if current_owner_identity else None,
        "current_owner_did": current_owner_identity["did"] if current_owner_identity else f"did:ethr:{doc['owner']}",
        "is_active": local_document.is_active if local_document else True,
        "is_transferable": local_document.is_transferable if local_document else False,
        "attributes": local_document.attributes if local_document else [],
        "versions": enriched_versions
    }


@router.get("/documents/{token_id}/owner-at")
async def get_owner_at_timestamp(token_id: int, timestamp: int, current_user: dict = Depends(get_current_user)):
    """Retrouve le propriétaire d'un document à un instant donné (timestamp Unix)."""
    owner = blockchain_client.get_owner_at_timestamp(token_id, timestamp)
    return {"token_id": token_id, "timestamp": timestamp, "owner": owner}
