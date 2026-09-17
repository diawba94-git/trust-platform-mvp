import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .db import open_session
from .models import AuthUser

security = HTTPBearer()


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=int(os.getenv("JWT_EXPIRATION", 3600)))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, os.getenv("JWT_SECRET"), algorithm=os.getenv("JWT_ALGORITHM", "HS256"))


def decode_access_token(token: str) -> dict:
    """Même secret/algorithme partagé par tous les modules (JWT_SECRET/JWT_ALGORITHM) — un
    seul système d'authentification distribué, jamais un JWT par module."""
    try:
        return jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=[os.getenv("JWT_ALGORITHM", "HS256")])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dépendance FastAPI importable telle quelle par n'importe quel module : décode le JWT
    (émis uniquement par le module auth) puis résout l'utilisateur via une session dédiée,
    indépendante de la session de la requête métier en cours."""
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = open_session()
    try:
        user = db.query(AuthUser).filter(AuthUser.id == int(user_id)).first()
    finally:
        db.close()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return {"id": user.id, "email": user.email, "role": user.role, "address": user.address}


def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
