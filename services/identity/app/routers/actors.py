from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from trustwedge_auth import get_current_user, hash_national_id
import os

from ..database import get_db
from ..models import User, UserRole, ROLE_TO_CONTRACT_ROLE
from ..schemas import ManagedUserCreateRequest, ActorCreateResponse
from ..services.did_service import DIDService
from ..services.affiliation_service import find_existing_person, attach_to_institution
from ..blockchain import BlockchainClient
from .. import documents_client

router = APIRouter(prefix="/actors", tags=["Actors"])

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
did_service = DIDService(ENCRYPTION_KEY)
blockchain_client = BlockchainClient()

_ALLOWED_TARGET_ROLES = {
    "ISSUER": {"USER"},
    "VERIFIER": {"USER", "VERIFIER"},
    "BANK": {"USER"},
}


@router.post("/create-managed-user", response_model=ActorCreateResponse)
def create_managed_user(
    request: ManagedUserCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """🎓/💼/🏦 ISSUER, VERIFIER ou BANK — Crée un compte géré (étudiant, employé, client, ou
    représentant VERIFIER supplémentaire pour une entreprise) et génère son DID."""
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
        national_id_number_hash=(
            hash_national_id(request.national_id_number) if request.national_id_number else None
        ),
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

    if request.date_of_birth and request.place_of_birth and request.national_id_number:
        documents_client.issue_id_card(
            owner_did=new_user.did, issuer=current_user,
            first_name=request.first_name, last_name=request.last_name,
            date_of_birth=request.date_of_birth,
            place_of_birth=request.place_of_birth,
            national_id_number=request.national_id_number,
        )

    return ActorCreateResponse(
        id=new_user.id,
        did=did_data["did"],
        address=did_data["address"],
        private_key=did_data["private_key"],
        public_key=did_data["public_key"],
        email=did_data["email"],
        full_name=did_data["full_name"],
        date_of_birth=request.date_of_birth,
        place_of_birth=request.place_of_birth,
        national_id_number=request.national_id_number,
        role=request.role,
        created_at=new_user.created_at,
    )
