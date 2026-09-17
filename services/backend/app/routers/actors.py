from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os

from ..database import get_db
from ..models import User, UserRole, ROLE_TO_CONTRACT_ROLE
from ..schemas import ManagedUserCreateRequest, ActorCreateResponse
from ..auth import get_current_user
from ..services.did_service import DIDService
from ..services.affiliation_service import find_existing_person, attach_to_institution
from ..blockchain import BlockchainClient
from ..ipfs_utils import IPFSClient
from ..workflow_engine import WorkflowEngine
from ..shared import event_bus

router = APIRouter(prefix="/actors", tags=["Actors"])

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
did_service = DIDService(ENCRYPTION_KEY)
blockchain_client = BlockchainClient()
ipfs_client = IPFSClient()

# Rôles autorisés à créer eux-mêmes des comptes pour leurs propres usagers — jamais
# n'importe quel rôle (contrairement à POST /admin/actors/create, réservé à ADMIN) :
# une université ne crée que des étudiants (USER), une entreprise ne crée que des
# employés (USER) ou d'autres représentants de la même entreprise (VERIFIER), une
# banque ne crée que ses clients (USER).
_ALLOWED_TARGET_ROLES = {
    "ISSUER": {"USER"},
    "VERIFIER": {"USER", "VERIFIER"},
    "BANK": {"USER"},
}


@router.post("/create-managed-user", response_model=ActorCreateResponse)
async def create_managed_user(
    request: ManagedUserCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """🎓/💼/🏦 ISSUER, VERIFIER ou BANK — Crée un compte géré (étudiant, employé, client, ou
    représentant VERIFIER supplémentaire pour une entreprise) et génère son DID. Si la personne
    (email ou n° de carte d'identité) a déjà un DID — ex. créé par l'Admin — elle est simplement
    rattachée à l'établissement appelant plutôt que dupliquée, pour que ce dernier puisse
    ensuite lui émettre un diplôme/une attestation/un service avec son DID existant."""
    allowed_roles = _ALLOWED_TARGET_ROLES.get(current_user["role"])
    if not allowed_roles:
        raise HTTPException(status_code=403, detail="Réservé aux universités, entreprises et banques")
    if request.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Rôle non autorisé : {request.role}")

    existing = find_existing_person(db, request.email, request.national_id_number)
    if existing:
        attach_to_institution(db, existing.id, current_user["id"])
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

    did_data = did_service.generate_did_for_actor(
        email=request.email, full_name=request.full_name, role=request.role
    )

    new_user = User(
        email=did_data["email"],
        full_name=did_data["full_name"],
        date_of_birth=request.date_of_birth,
        place_of_birth=request.place_of_birth,
        national_id_number=request.national_id_number,
        role=request.role,
        did=did_data["did"],
        address=did_data["address"],
        private_key_encrypted=did_data["encrypted_private_key"],
        public_key=did_data["public_key"],
        created_by=current_user["id"],
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    blockchain_client.fund_account(did_data["address"])
    contract_role = ROLE_TO_CONTRACT_ROLE.get(UserRole(request.role))
    if contract_role:
        blockchain_client.grant_role(contract_role, did_data["address"])

    # Identité civile saisie (Nom, Prénom, date/lieu de naissance, CNI) -> pièce d'identité
    # (ID_CARD) enregistrée dans le registre, visible dans "Pièces d'identité".
    if request.date_of_birth and request.place_of_birth and request.national_id_number:
        engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
        await engine.issue_id_card(new_user, current_user, request.first_name, request.last_name)

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
        role=request.role,
        created_at=new_user.created_at,
    )
