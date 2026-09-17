import os
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Engine/session créés à la première utilisation (pas à l'import) : chaque module appelant
# fixe sa propre DATABASE_URL dans son environnement avant de faire une requête authentifiée
# — et cela permet aux tests de pointer vers une base isolée sans dépendre de l'ordre
# d'import. Un seul engine par process (mis en cache), comme le ferait le `database.py`
# propre à chaque module.
_engine = None
_SessionLocal = None


def _get_session_factory():
    global _engine, _SessionLocal
    if _SessionLocal is None:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError(
                "DATABASE_URL non défini — requis par trustwedge_auth pour résoudre "
                "l'utilisateur associé à un JWT"
            )
        _engine = create_engine(database_url)
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _SessionLocal


def open_session() -> Session:
    """Session courte, dédiée à une seule lecture (résolution d'un utilisateur depuis son
    JWT) — pas la session de la requête métier en cours, que chaque module continue de gérer
    lui-même via son propre `get_db()`."""
    return _get_session_factory()()


def reset_engine_cache_for_tests() -> None:
    """Permet aux tests de changer DATABASE_URL entre deux suites sans réutiliser un engine
    pointant vers la base précédente."""
    global _engine, _SessionLocal
    _engine = None
    _SessionLocal = None
