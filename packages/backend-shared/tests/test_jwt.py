from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from jose import jwt

from trustwedge_auth.jwt_utils import create_access_token, decode_access_token


def test_round_trip_preserves_claims():
    token = create_access_token({"sub": "1", "role": "ADMIN"})
    payload = decode_access_token(token)
    assert payload["sub"] == "1"
    assert payload["role"] == "ADMIN"
    assert "exp" in payload


def test_tampered_token_rejected():
    token = create_access_token({"sub": "1", "role": "ADMIN"})
    tampered = token[:-4] + ("A" * 4 if not token.endswith("AAAA") else "BBBB")
    with pytest.raises(HTTPException) as exc:
        decode_access_token(tampered)
    assert exc.value.status_code == 401


def test_token_signed_with_wrong_secret_rejected():
    forged = jwt.encode(
        {"sub": "1", "role": "ADMIN", "exp": datetime.utcnow() + timedelta(hours=1)},
        "not-the-real-secret",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        decode_access_token(forged)
    assert exc.value.status_code == 401


def test_expired_token_rejected():
    import os
    expired = jwt.encode(
        {"sub": "1", "role": "ADMIN", "exp": datetime.utcnow() - timedelta(hours=1)},
        os.environ["JWT_SECRET"],
        algorithm=os.environ["JWT_ALGORITHM"],
    )
    with pytest.raises(HTTPException) as exc:
        decode_access_token(expired)
    assert exc.value.status_code == 401
