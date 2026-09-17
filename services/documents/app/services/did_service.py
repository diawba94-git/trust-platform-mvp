from cryptography.fernet import Fernet
from eth_account import Account
from eth_keys import keys
import secrets
from typing import Optional, Dict
from sqlalchemy.orm import Session

from ..models import User

class DIDService:
    def __init__(self, encryption_key: str):
        self.cipher = Fernet(encryption_key.encode())

    def generate_did_for_actor(self, email: str, full_name: str, role: str) -> Dict:
        """
        Génère un DID pour un acteur.
        Retourne le DID, l'adresse, la clé privée et la clé publique.
        """
        # 1. Générer la paire de clés
        private_key = secrets.token_hex(32)
        account = Account.from_key(private_key)
        address = account.address
        did = f"did:ethr:{address}"

        # 2. Chiffrer la clé privée
        encrypted_private_key = self.cipher.encrypt(private_key.encode()).decode()

        return {
            "did": did,
            "address": address,
            "private_key": private_key,  # ← En clair pour transmission à l'acteur
            "public_key": keys.PrivateKey(bytes(account.key)).public_key.to_hex(),
            "encrypted_private_key": encrypted_private_key,
            "email": email,
            "full_name": full_name,
            "role": role
        }

    def get_private_key(self, user_id: int, db: Session) -> Optional[str]:
        """Récupère et déchiffre la clé privée d'un utilisateur."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.private_key_encrypted:
            return None
        return self.cipher.decrypt(user.private_key_encrypted.encode()).decode()

    def encrypt_private_key(self, private_key: str) -> str:
        """Chiffre une clé privée."""
        return self.cipher.encrypt(private_key.encode()).decode()
