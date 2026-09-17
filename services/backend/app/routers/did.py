from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os

from ..database import get_db
from ..models import User, UserRole, ROLE_TO_CONTRACT_ROLE
from ..schemas import MyCredentialsResponse
from ..auth import get_current_user
from ..services.did_service import DIDService
from ..blockchain import BlockchainClient

router = APIRouter(tags=["DID"])

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
did_service = DIDService(ENCRYPTION_KEY)
blockchain_client = BlockchainClient()

@router.get("/did/my", response_model=MyCredentialsResponse)
async def get_my_credentials(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    👤 ACTEUR - Récupère ses identifiants (DID + clé privée).
    La clé privée est déchiffrée et retournée uniquement à l'utilisateur authentifié.
    """
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.did:
        raise HTTPException(status_code=404, detail="No DID found for this user")

    # Déchiffrer la clé privée
    private_key = did_service.get_private_key(user.id, db)

    return MyCredentialsResponse(
        id=user.id,
        did=user.did,
        address=user.address,
        private_key=private_key,
        public_key=user.public_key,
        email=user.email,
        full_name=user.full_name,
        role=user.role
    )

@router.post("/did/regenerate")
async def regenerate_private_key(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    👤 ACTEUR - Régénère une nouvelle clé privée.
    L'ancienne clé est révoquée et remplacée.
    """
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from eth_account import Account
    from eth_keys import keys
    import secrets

    old_address = user.address

    new_private_key = secrets.token_hex(32)
    account = Account.from_key(new_private_key)
    new_address = account.address

    # Mettre à jour l'utilisateur
    user.private_key_encrypted = did_service.encrypt_private_key(new_private_key)
    user.address = new_address
    user.public_key = keys.PrivateKey(bytes(account.key)).public_key.to_hex()
    db.commit()

    # Financer la nouvelle adresse — sinon elle ne peut payer le gas d'aucune transaction.
    blockchain_client.fund_account(new_address)

    # Déplacer le rôle on-chain (ISSUER/VERIFIER/NOTARY) de l'ancienne vers la nouvelle
    # adresse — sinon l'acteur perdrait son rôle en régénérant sa clé, et l'ancienne
    # adresse abandonnée le conserverait indûment.
    try:
        role_enum = UserRole(user.role)
    except ValueError:
        role_enum = None
    if role_enum in ROLE_TO_CONTRACT_ROLE:
        contract_role = ROLE_TO_CONTRACT_ROLE[role_enum]
        blockchain_client.grant_role(contract_role, new_address)
        if old_address:
            blockchain_client.revoke_role(contract_role, old_address)

    return {
        "status": "regenerated",
        "new_address": new_address,
        "new_did": f"did:ethr:{new_address}"
    }
