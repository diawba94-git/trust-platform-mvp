"""Endpoints internes (réseau Docker uniquement, non routés par Kong) — permettent aux
modules documents/verify/exchange de résoudre une adresse blockchain en identité connue
sans jamais interroger directement la table `users`, dont ce module reste seul propriétaire
en écriture."""
from typing import List

from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from fastapi import Depends

from ..database import get_db
from ..models import User

router = APIRouter(prefix="/internal/identity", tags=["Internal"])


@router.get("/by-address")
def resolve_by_address(addresses: str = Query(..., description="Adresses séparées par des virgules"), db: Session = Depends(get_db)):
    """Résout une liste d'adresses blockchain vers {id, full_name, email} — utilisé pour
    afficher un nom lisible (PDF, listes) sans que documents/verify/exchange n'accèdent
    directement à la table User."""
    address_list: List[str] = [a for a in addresses.split(",") if a]
    if not address_list:
        return {}
    users = db.query(User).filter(User.address.in_(address_list)).all()
    return {
        u.address: {"id": u.id, "full_name": u.full_name, "email": u.email, "did": u.did}
        for u in users
    }
