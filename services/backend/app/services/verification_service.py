import hashlib
import os
import random
from datetime import datetime, timedelta
from typing import Tuple

from jose import jwt, JWTError

_SECRET = os.getenv("JWT_SECRET")
_ALGORITHM = "HS256"


def generate_phone_code(phone: str) -> Tuple[str, str]:
    """Génère un code à 6 chiffres et un token signé (expire dans 5 min) qui le porte sous
    forme de hash — le code lui-même n'est jamais stocké nulle part, seulement son empreinte.
    MOCK : aucun envoi SMS réel (pas de Twilio branché) — le code est juste loggé côté serveur
    (`docker compose logs backend`) à la place. À remplacer avant toute mise en production."""
    code = f"{random.randint(0, 999999):06d}"
    payload = {
        "purpose": "phone_verification",
        "phone": phone,
        "code_hash": hashlib.sha256(code.encode()).hexdigest(),
        "exp": datetime.utcnow() + timedelta(minutes=5),
    }
    token = jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)
    print(f"[MOCK SMS] Code de vérification pour {phone} : {code}")
    return token, code


def verify_phone_code(token: str, code: str) -> bool:
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
    except JWTError:
        return False
    if payload.get("purpose") != "phone_verification":
        return False
    return payload.get("code_hash") == hashlib.sha256(code.encode()).hexdigest()


def generate_email_token(email: str) -> str:
    """MOCK : aucun envoi d'email réel (pas de SMTP/SendGrid branché) — le lien est juste
    loggé côté serveur à la place. À remplacer avant toute mise en production."""
    payload = {
        "purpose": "email_verification",
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=24),
    }
    token = jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)
    print(f"[MOCK EMAIL] Lien de confirmation pour {email} : trustwedge://verify-email?token={token}")
    return token


def verify_email_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
    except JWTError:
        return False
    return payload.get("purpose") == "email_verification"
