import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, DocumentShare, User
from ..schemas import ShareCreateRequest, ShareOut, ShareResolveResponse
from ..auth import get_current_user
from ..blockchain import BlockchainClient

router = APIRouter(prefix="/shares", tags=["Shares"])

blockchain_client = BlockchainClient()


def _to_share_out(share: DocumentShare, doc: Document | None) -> ShareOut:
    return ShareOut(
        id=share.id,
        share_token=share.share_token,
        token_id=share.token_id,
        doc_type=doc.doc_type if doc else None,
        doc_key=doc.doc_key if doc else None,
        access_level=share.access_level,
        expires_at=share.expires_at,
        revoked=share.revoked,
        created_at=share.created_at,
    )


@router.post("", response_model=ShareOut)
async def create_share(
    request: ShareCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Génère un lien de partage pour un document qu'on possède — utilisé par le wallet
    (écran "Partages"). Le lien lui-même ne contient aucune donnée du document : ouvrir
    GET /shares/{share_token} relit toujours l'état réel on-chain (cf. ShareResolveResponse)."""
    doc = db.query(Document).filter(Document.token_id == request.token_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if doc.owner != current_user["address"]:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas propriétaire de ce document")
    if request.access_level not in ("view", "download"):
        raise HTTPException(status_code=400, detail="access_level doit être 'view' ou 'download'")

    expires_at = None
    if request.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=request.expires_in_days)

    share = DocumentShare(
        share_token=secrets.token_urlsafe(16),
        token_id=request.token_id,
        created_by=current_user["id"],
        access_level=request.access_level,
        expires_at=expires_at,
    )
    db.add(share)
    db.commit()
    db.refresh(share)
    return _to_share_out(share, doc)


@router.get("/mine", response_model=list[ShareOut])
async def list_my_shares(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Liste des liens de partage créés par l'utilisateur courant (écran "Partages")."""
    shares = (
        db.query(DocumentShare)
        .filter(DocumentShare.created_by == current_user["id"])
        .order_by(DocumentShare.created_at.desc())
        .all()
    )
    token_ids = {s.token_id for s in shares}
    docs = {
        d.token_id: d
        for d in db.query(Document).filter(Document.token_id.in_(token_ids)).all()
    } if token_ids else {}
    return [_to_share_out(s, docs.get(s.token_id)) for s in shares]


@router.delete("/{share_token}")
async def revoke_share(
    share_token: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Révoque un lien de partage — celui qui le détient encore ne peut plus l'ouvrir."""
    share = db.query(DocumentShare).filter(DocumentShare.share_token == share_token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Lien de partage introuvable")
    if share.created_by != current_user["id"]:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas à l'origine de ce lien")
    share.revoked = True
    db.commit()
    return {"revoked": True}


@router.get("/{share_token}", response_model=ShareResolveResponse)
async def resolve_share(share_token: str, db: Session = Depends(get_db)):
    """Résolution publique d'un lien de partage (sans authentification — c'est le but d'un
    lien à partager). Relit toujours l'état réel on-chain plutôt que de faire confiance au
    cache local, pour qu'un document révoqué entre-temps n'apparaisse jamais comme valide."""
    share = db.query(DocumentShare).filter(DocumentShare.share_token == share_token).first()
    if not share:
        raise HTTPException(status_code=404, detail="Lien de partage introuvable")
    if share.revoked:
        raise HTTPException(status_code=410, detail="Ce lien de partage a été révoqué")
    if share.expires_at and share.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Ce lien de partage a expiré")

    doc = blockchain_client.verify_document(share.token_id)
    owner_user = db.query(User).filter(User.address == doc["owner"]).first()
    issuer_user = db.query(User).filter(User.address == doc["issuer"]).first()
    local_document = db.query(Document).filter(Document.token_id == share.token_id).first()

    return ShareResolveResponse(
        isValid=doc["isValid"],
        docType=doc["docType"],
        docKey=local_document.doc_key if local_document else None,
        owner_name=owner_user.full_name if owner_user else None,
        issuer_name=issuer_user.full_name if issuer_user else None,
        access_level=share.access_level,
        can_download=share.access_level == "download",
    )
