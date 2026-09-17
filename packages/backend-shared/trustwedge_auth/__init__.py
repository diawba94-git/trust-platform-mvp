"""Bibliothèque d'authentification partagée par les futurs modules du backend TrustWedge.

Un seul système d'authentification, distribué (pas dupliqué) : le module `auth` reste
l'unique émetteur de JWT (login/mot de passe), les cinq autres modules importent
`get_current_user`/`get_current_admin` d'ici pour valider le même token avec le même
secret (JWT_SECRET/JWT_ALGORITHM), sans jamais réimplémenter leur propre vérification.
"""

from .db import open_session, reset_engine_cache_for_tests
from .jwt_utils import create_access_token, decode_access_token, get_current_admin, get_current_user
from .models import AuthBase, AuthUser
from .pii import hash_national_id
from .security import get_password_hash, verify_password

__all__ = [
    "get_password_hash",
    "verify_password",
    "hash_national_id",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "get_current_admin",
    "AuthBase",
    "AuthUser",
    "open_session",
    "reset_engine_cache_for_tests",
]
