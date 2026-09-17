from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from eth_account import Account
import os

from ..database import get_db
from typing import Optional

from ..models import User, UserRole, Document, Workflow, ROLE_TO_CONTRACT_ROLE
from ..schemas import ActorCreateRequest, ActorCreateResponse
from ..auth import get_current_admin
from ..services.did_service import DIDService
from ..services.affiliation_service import find_existing_person, attach_to_institution
from ..blockchain import BlockchainClient
from ..ipfs_utils import IPFSClient
from ..services import ocr_service
from ..workflow_engine import WorkflowEngine
from ..shared import event_bus

router = APIRouter(prefix="/admin", tags=["Admin"])

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
did_service = DIDService(ENCRYPTION_KEY)
blockchain_client = BlockchainClient()
ipfs_client = IPFSClient()


@router.post("/actors/create", response_model=ActorCreateResponse)
async def create_actor_with_did(
    request: ActorCreateRequest,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    👑 ADMIN - Crée un acteur et génère son DID, ou rattache un acteur existant.

    Cette route :
    1. Vérifie si la personne (email ou n° de carte d'identité) existe déjà — si oui, ne
       génère PAS de second DID : elle est simplement rattachée à l'admin appelant et ses
       informations existantes sont retournées (already_existed=True, sans clé privée).
    2. Sinon, génère une paire de clés pour l'acteur
    3. Construit le DID (did:ethr:0x...)
    4. Rattache le DID à l'acteur en base
    5. Finance le compte en ETH et attribue son rôle on-chain si applicable
    6. Retourne les identifiants (DID + clé privée)
    """
    # 1. Vérifier si cette personne est déjà connue de la plateforme
    existing = find_existing_person(db, request.email, request.national_id_number)
    if existing:
        attach_to_institution(db, existing.id, admin["id"])
        return ActorCreateResponse(
            id=existing.id,
            did=existing.did,
            address=existing.address,
            public_key=existing.public_key,
            email=existing.email,
            full_name=existing.full_name,
            date_of_birth=existing.date_of_birth,
            place_of_birth=existing.place_of_birth,
            national_id_number=existing.national_id_number,
            role=existing.role,
            created_at=existing.created_at,
            already_existed=True,
        )

    # 2. Générer le DID pour l'acteur
    did_data = did_service.generate_did_for_actor(
        email=request.email,
        full_name=request.full_name,
        role=request.role.value
    )

    # 3. Créer l'acteur avec son DID rattaché
    new_user = User(
        email=did_data["email"],
        full_name=did_data["full_name"],
        date_of_birth=request.date_of_birth,
        place_of_birth=request.place_of_birth,
        national_id_number=request.national_id_number,
        role=request.role.value,
        did=did_data["did"],
        address=did_data["address"],
        private_key_encrypted=did_data["encrypted_private_key"],
        public_key=did_data["public_key"],
        created_by=admin["id"],
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 4. Financer le compte en ETH — sans solde, l'acteur ne peut payer le gas d'aucune
    # transaction (signature de document, transfert, ...) et resterait bloqué en pratique.
    blockchain_client.fund_account(did_data["address"])

    # 5. Si rôle spécifique, attribuer sur la blockchain
    if request.role in ROLE_TO_CONTRACT_ROLE:
        blockchain_client.grant_role(ROLE_TO_CONTRACT_ROLE[request.role], did_data["address"])

    # 6. Identité civile saisie (Nom, Prénom, date/lieu de naissance, CNI) -> pièce
    # d'identité (ID_CARD) enregistrée dans le registre, visible dans "Pièces d'identité".
    if request.date_of_birth and request.place_of_birth and request.national_id_number:
        engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
        await engine.issue_id_card(new_user, admin, request.first_name, request.last_name)

    # 7. Retourner les identifiants (clé privée en clair pour transmission)
    return ActorCreateResponse(
        id=new_user.id,
        did=did_data["did"],
        address=did_data["address"],
        private_key=did_data["private_key"],
        public_key=did_data["public_key"],
        email=did_data["email"],
        full_name=did_data["full_name"],
        date_of_birth=new_user.date_of_birth,
        place_of_birth=new_user.place_of_birth,
        national_id_number=new_user.national_id_number,
        role=did_data["role"],
        created_at=new_user.created_at
    )


@router.post("/land-titles/ocr-extract")
async def ocr_extract_land_title(
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    """
    👑 ADMIN - Lit un fichier (scan/PDF) par OCR et propose une extraction des champs du
    titre foncier (référence, localisation, superficie, valeur). Purement indicatif : les
    valeurs doivent être vérifiées/corrigées par l'admin avant validation de l'import —
    aucune donnée n'est enregistrée par cette route.
    """
    content = await file.read()
    try:
        text = ocr_service.extract_text(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lecture OCR impossible : {e}")

    fields = ocr_service.extract_land_title_fields(text)
    return {"filename": file.filename, **fields}


@router.post("/land-titles/import")
async def import_land_title(
    owner_email: str = Form(...),
    doc_key: str = Form(...),
    location: str = Form(...),
    land_area: str = Form(...),
    value: str = Form(...),
    is_transferable: bool = Form(True),
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    👑 ADMIN - Émet un NOUVEAU titre foncier en important son fichier existant (scan d'un
    titre déjà délivré), plutôt qu'en générant un PDF à partir d'attributs saisis à la main.

    Uniquement pour de NOUVEAUX titres : le contrôle d'unicité (doc_type + doc_key) empêche
    toute réémission d'un titre déjà enregistré, et cette route ne permet ni modification ni
    transfert d'un titre existant.
    """
    owner = db.query(User).filter(User.email == owner_email, User.is_active == True).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Propriétaire introuvable (email non enregistré)")

    if blockchain_client.exists_by_type_and_key("LAND_TITLE", doc_key):
        raise HTTPException(
            status_code=400,
            detail=f"Un titre foncier avec la référence '{doc_key}' existe déjà"
        )

    content = await file.read()
    ipfs_cid = ipfs_client.upload_and_pin(content, file.filename)

    attributes = [
        {"key": "landArea", "value": land_area, "valueType": "uint256"},
        {"key": "location", "value": location, "valueType": "string"},
        {"key": "value", "value": value, "valueType": "uint256"},
    ]

    platform_key = os.getenv("PRIVATE_KEY")
    platform_address = Account.from_key(platform_key).address

    token_id = blockchain_client.issue_document(
        doc_type="LAND_TITLE",
        doc_key=doc_key,
        issuer_did=f"did:ethr:{platform_address}",
        owner=owner.address,
        attributes=attributes,
        ipfs_cid=ipfs_cid,
        is_transferable=is_transferable,
        signer_private_key=platform_key,
    )

    document = Document(
        token_id=token_id,
        issuer=admin["address"],
        owner=owner.address,
        doc_type="LAND_TITLE",
        doc_key=doc_key,
        ipfs_cid=ipfs_cid,
        is_active=True,
        is_transferable=is_transferable,
        attributes=attributes,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return {
        "id": document.id,
        "token_id": document.token_id,
        "owner": owner.email,
        "doc_key": doc_key,
        "ipfs_cid": ipfs_cid,
    }


@router.get("/documents")
async def list_all_documents(
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """👑 ADMIN - Liste tous les documents enregistrés (pour retrouver un Token ID et consulter son historique)."""
    documents = db.query(Document).order_by(Document.created_at.desc()).all()
    issuer_addresses = {d.issuer for d in documents}
    owner_addresses = {d.owner for d in documents}
    users_by_address = {
        u.address: u.full_name
        for u in db.query(User).filter(User.address.in_(issuer_addresses | owner_addresses)).all()
    } if (issuer_addresses | owner_addresses) else {}
    return [
        {
            "id": d.id,
            "token_id": d.token_id,
            "doc_type": d.doc_type,
            "doc_key": d.doc_key,
            "issuer": users_by_address.get(d.issuer, d.issuer),
            "owner": users_by_address.get(d.owner, d.owner),
            "is_active": d.is_active,
            "is_transferable": d.is_transferable,
            "created_at": d.created_at,
        } for d in documents
    ]


@router.get("/workflows")
async def list_all_workflows(
    type: Optional[str] = None,
    admin: dict = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """👑 ADMIN - Vue globale de tous les workflows (toutes parties confondues), contrairement
    à GET /workflows/my qui ne renvoie que ceux de l'appelant. Alimente "Demandes & Workflows"
    et "Transferts" du tableau de bord admin."""
    query = db.query(Workflow)
    if type:
        query = query.filter(Workflow.workflow_type == type)
    workflows = query.order_by(Workflow.created_at.desc()).all()

    user_ids = {w.initiator_id for w in workflows} | {w.target_user_id for w in workflows} | {w.notary_id for w in workflows}
    user_ids.discard(None)
    names_by_id = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    return [
        {
            "id": w.id,
            "type": w.workflow_type.value,
            "status": w.status.value,
            "initiator": names_by_id.get(w.initiator_id, w.initiator_id),
            "target": names_by_id.get(w.target_user_id, w.target_user_id) if w.target_user_id else None,
            "notary": names_by_id.get(w.notary_id, w.notary_id) if w.notary_id else None,
            "document_token_id": w.document_token_id,
            "workflow_data": w.workflow_data,
            "created_at": w.created_at,
            "completed_at": w.completed_at,
        } for w in workflows
    ]
