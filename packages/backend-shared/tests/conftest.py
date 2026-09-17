import os
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from trustwedge_auth.models import AuthBase, AuthUser
from trustwedge_auth.security import get_password_hash
import trustwedge_auth.db as auth_db

# Base isolée (fichier SQLite temporaire, jamais la vraie base Postgres) — c'est le sens de
# "tester cette bibliothèque isolément" : aucune dépendance à l'environnement Docker/Postgres
# du monolithe pour valider register/login/token/rôles.
os.environ["JWT_SECRET"] = "test-secret-not-for-prod"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["JWT_EXPIRATION"] = "1"


@pytest.fixture()
def db_url(tmp_path):
    db_file = tmp_path / "test_auth.db"
    return f"sqlite:///{db_file}"


@pytest.fixture()
def seeded_db(db_url):
    """Crée le schéma minimal (AuthBase) dans une base SQLite jetable, y insère un admin et
    un utilisateur standard, et pointe trustwedge_auth.db dessus le temps du test."""
    os.environ["DATABASE_URL"] = db_url
    auth_db.reset_engine_cache_for_tests()

    engine = create_engine(db_url)
    AuthBase.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add(AuthUser(
        id=1, email="admin@test.com", role="ADMIN", address="0xADMIN",
        hashed_password=get_password_hash("adminpass"), is_active=True,
    ))
    session.add(AuthUser(
        id=2, email="user@test.com", role="USER", address="0xUSER",
        hashed_password=get_password_hash("userpass"), is_active=True,
    ))
    session.add(AuthUser(
        id=3, email="legacy@test.com", role="USER", address="0xLEGACY",
        hashed_password=None, is_active=True,
    ))
    session.commit()
    session.close()

    yield

    auth_db.reset_engine_cache_for_tests()
