import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from trustwedge_auth import get_password_hash, hash_national_id

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
    ajoutées/supprimées sur un modèle existant — le projet n'a pas d'Alembic. Ces
    ALTER TABLE idempotents comblent l'écart pour les bases déjà provisionnées.

    national_id_number_hash remplace les anciennes colonnes en clair date_of_birth /
    place_of_birth / national_id_number (la plateforme ne doit pas conserver l'identité
    civile — seul un hash déterministe du n° de CNI est gardé, pour la déduplication dans
    find_existing_person). Les valeurs déjà en base sont hashées avant que les colonnes en
    clair ne soient supprimées."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id_number_hash VARCHAR"))

        has_legacy_column = conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'users' AND column_name = 'national_id_number'"
        )).first()
        if has_legacy_column:
            rows = conn.execute(text(
                "SELECT id, national_id_number FROM users "
                "WHERE national_id_number IS NOT NULL AND national_id_number_hash IS NULL"
            )).fetchall()
            for user_id, national_id_number in rows:
                conn.execute(
                    text("UPDATE users SET national_id_number_hash = :hash WHERE id = :id"),
                    {"hash": hash_national_id(national_id_number), "id": user_id},
                )
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS date_of_birth"))
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS place_of_birth"))
            conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS national_id_number"))

        conn.execute(text("DROP INDEX IF EXISTS ix_users_national_id_number"))
        # Postgres exclut nativement les NULL d'un index unique, donc les comptes existants
        # sans CNI ne provoquent aucun conflit entre eux.
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_national_id_number_hash "
            "ON users (national_id_number_hash)"
        ))

        # Authentification par mot de passe (auth.py ne vérifiait auparavant aucun mot de
        # passe au login — faille critique). Colonne nullable : les comptes déjà en base n'ont
        # pas de mot de passe et restent bloqués au login jusqu'à ce qu'un admin leur en
        # définisse un explicitement (POST /admin/actors/{id}/set-password) — jamais de valeur
        # générée automatiquement à leur place.
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR"))

        # Cas particulier du tout premier compte ADMIN : comme il n'existe aucune interface
        # pour créer le premier acteur sans déjà être admin, le login serait bloqué même pour
        # la personne censée débloquer tous les autres comptes via l'endpoint ci-dessus.
        # ADMIN_PASSWORD est déjà généré par scripts/init-environment.js précisément pour cet
        # usage (jamais utilisé jusqu'ici, cf. docs/10-INITIALISATION-ENVIRONNEMENT.md §5) —
        # ce n'est donc pas un mot de passe généré à la volée pour contourner la règle
        # ci-dessus, mais l'activation du secret déjà provisionné pour ce rôle précis. Ne
        # s'applique qu'au compte ADMIN dont l'email correspond à ADMIN_EMAIL, et seulement
        # s'il n'a pas déjà de mot de passe.
        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        if admin_email and admin_password:
            conn.execute(
                text(
                    "UPDATE users SET hashed_password = :hash "
                    "WHERE email = :email AND role = 'ADMIN' AND hashed_password IS NULL"
                ),
                {"hash": get_password_hash(admin_password), "email": admin_email},
            )
