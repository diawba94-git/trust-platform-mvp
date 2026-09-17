from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import User, UserAffiliation


def find_existing_person(db: Session, email: str, national_id_number: Optional[str]) -> Optional[User]:
    """Retrouve une personne déjà identifiée sur la plateforme (DID existant), pour éviter
    qu'un nouvel acteur (université, entreprise, ...) lui en génère un second par erreur.
    Le numéro de carte d'identité est la clé de rapprochement prioritaire (une même personne
    peut changer d'email), l'email reste un second signal. Si les deux pointent vers deux
    comptes différents, on refuse plutôt que de deviner lequel est le bon."""
    existing_by_nid = (
        db.query(User).filter(User.national_id_number == national_id_number).first()
        if national_id_number else None
    )
    existing_by_email = db.query(User).filter(User.email == email).first()

    if existing_by_nid and existing_by_email and existing_by_nid.id != existing_by_email.id:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cet email et ce numéro de carte d'identité correspondent à deux comptes "
                "déjà enregistrés différents — vérifiez les informations saisies."
            ),
        )
    return existing_by_nid or existing_by_email


def attach_to_institution(db: Session, user_id: int, institution_id: int) -> None:
    """Rattache une personne déjà existante à un acteur qui vient de la 're-créer' (ex. une
    université qui a besoin de retrouver un citoyen déjà identifié par l'Admin pour lui
    émettre un diplôme), sans toucher à son DID ni à son User.created_by d'origine."""
    if user_id == institution_id:
        return
    already = (
        db.query(UserAffiliation)
        .filter(UserAffiliation.user_id == user_id, UserAffiliation.institution_id == institution_id)
        .first()
    )
    if already:
        return
    db.add(UserAffiliation(user_id=user_id, institution_id=institution_id))
    db.commit()
