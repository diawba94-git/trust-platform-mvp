from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import declarative_base

# Base déclarative propre à ce paquet — jamais utilisée pour créer/modifier le schéma
# (`AuthBase.metadata.create_all()` n'est appelé que par les tests, sur une base isolée).
# En production, la table `users` reste créée et possédée par le module qui en a
# l'autorité (aujourd'hui le monolithe, demain le module identity) ; AuthUser n'en est
# qu'une projection en lecture des colonnes nécessaires à la vérification d'un JWT —
# partageable par tous les modules sans dépendre du modèle User complet d'un module donné,
# qui continuera d'évoluer avec des colonnes que les autres modules n'ont pas à connaître.
AuthBase = declarative_base()


class AuthUser(AuthBase):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)
    role = Column(String)
    address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
