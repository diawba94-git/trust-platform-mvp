import os
import requests

DOCUMENTS_URL = os.getenv("DOCUMENTS_SERVICE_URL", "http://documents:8000")


def get_status(token_id: int) -> dict:
    """Lit le statut local (miroir DB) d'un document — remplace l'ancien accès direct à la
    table Document depuis transfers.py/shares.py/disclosure.py : exchange ne détient plus
    d'accès en écriture sur Document, ce module reste celui du module documents."""
    response = requests.get(f"{DOCUMENTS_URL}/internal/documents/{token_id}/status", timeout=15)
    response.raise_for_status()
    return response.json()


def mark_transferred(token_id: int, new_owner: str, new_cid: str) -> None:
    response = requests.post(
        f"{DOCUMENTS_URL}/internal/documents/{token_id}/mark-transferred",
        params={"new_owner": new_owner, "new_cid": new_cid},
        timeout=15,
    )
    response.raise_for_status()
