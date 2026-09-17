import os
import requests

DOCUMENTS_URL = os.getenv("DOCUMENTS_SERVICE_URL", "http://documents:8000")


def issue_id_card(
    owner_did: str, issuer: dict,
    first_name: str = None, last_name: str = None,
    date_of_birth: str = None, place_of_birth: str = None, national_id_number: str = None,
) -> dict:
    """Appelle le module documents (HTTP interne) pour émettre la pièce d'identité (ID_CARD)
    d'un acteur tout juste créé — remplace l'ancien appel en process à
    WorkflowEngine.issue_id_card. `issuer` (id/role/address) n'est pas revérifié côté
    documents pour cet appel précis : créer ce DID a déjà implicitement autorisé l'émission
    (même règle que l'ancien monolithe), contrairement à POST /documents/issue qui, lui,
    reste réservé aux rôles ISSUER/VERIFIER/NOTARY/ADMIN."""
    response = requests.post(
        f"{DOCUMENTS_URL}/internal/documents/issue-id-card",
        json={
            "owner_did": owner_did,
            "issuer_id": issuer["id"], "issuer_role": issuer["role"], "issuer_address": issuer["address"],
            "first_name": first_name, "last_name": last_name,
            "date_of_birth": date_of_birth, "place_of_birth": place_of_birth,
            "national_id_number": national_id_number,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()
