import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://trustwedge:TrustWedge2024@postgres:5432/trustwedge")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_light_migrations():
    """Base.metadata.create_all ne crée que les tables manquantes, jamais les colonnes
    ajoutées à un modèle existant — le projet n'a pas d'Alembic. Ces ALTER TABLE idempotents
    comblent l'écart pour les bases déjà provisionnées (ex. ajout des champs d'identité civile
    sur `users`)."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id_number VARCHAR"))
        # Index unique standard (comme celui que create_all générerait sur une base neuve) :
        # Postgres exclut nativement les NULL d'un index unique, donc les comptes existants
        # sans CNI ne provoquent aucun conflit entre eux.
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_national_id_number "
            "ON users (national_id_number)"
        ))
