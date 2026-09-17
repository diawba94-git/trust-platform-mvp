from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from .database import Base


class User(Base):
    """Projection locale de `users` — seules email/hashed_password sont écrites après la
    création initiale du compte (POST /auth/register). Les autres colonnes (did/address/...)
    ne sont posées qu'à l'INSERT, pour produire une ligne complète : leur tenue à jour dans
    la durée reste la responsabilité du module identity."""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    did = Column(String, unique=True, index=True)
    address = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    role = Column(String)
    hashed_password = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
