import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from trustwedge_auth.jwt_utils import create_access_token, get_current_admin, get_current_user


def bearer(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_valid_token_resolves_user(seeded_db):
    token = create_access_token({"sub": "2", "role": "USER"})
    user = get_current_user(bearer(token))
    assert user == {"id": 2, "email": "user@test.com", "role": "USER", "address": "0xUSER"}


def test_invalid_token_rejected(seeded_db):
    with pytest.raises(HTTPException) as exc:
        get_current_user(bearer("not-a-real-jwt"))
    assert exc.value.status_code == 401


def test_token_for_unknown_user_rejected(seeded_db):
    token = create_access_token({"sub": "999", "role": "USER"})
    with pytest.raises(HTTPException) as exc:
        get_current_user(bearer(token))
    assert exc.value.status_code == 401


def test_admin_dependency_allows_admin(seeded_db):
    token = create_access_token({"sub": "1", "role": "ADMIN"})
    current_user = get_current_user(bearer(token))
    assert get_current_admin(current_user)["role"] == "ADMIN"


def test_admin_dependency_rejects_non_admin(seeded_db):
    token = create_access_token({"sub": "2", "role": "USER"})
    current_user = get_current_user(bearer(token))
    with pytest.raises(HTTPException) as exc:
        get_current_admin(current_user)
    assert exc.value.status_code == 403


def test_legacy_user_without_password_can_still_be_resolved_from_token(seeded_db):
    """get_current_user ne revérifie pas le mot de passe (déjà fait au login, une seule
    fois) — un compte sans hashed_password reste résolvable UNE FOIS qu'un JWT existe déjà ;
    c'est login_user (module auth, hors bibliothèque partagée) qui refuse d'en émettre un
    pour ce compte tant qu'aucun mot de passe n'est défini."""
    token = create_access_token({"sub": "3", "role": "USER"})
    user = get_current_user(bearer(token))
    assert user["email"] == "legacy@test.com"
