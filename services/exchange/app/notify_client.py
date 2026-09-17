import os
import requests

CORE_URL = os.getenv("CORE_SERVICE_URL", "http://backend:8000")


def notify(user_id: int, type: str, message: str, workflow_id: int = None, token_id: int = None) -> None:
    """Persiste une notification et la pousse en temps réel si l'utilisateur est connecté —
    déléguée au service core (hôte du bus WebSocket, cf. /internal/notify), best-effort :
    une erreur ici ne doit jamais faire échouer l'opération métier déjà réalisée."""
    try:
        requests.post(
            f"{CORE_URL}/internal/notify",
            json={"user_id": user_id, "type": type, "message": message, "workflow_id": workflow_id, "token_id": token_id},
            timeout=10,
        )
    except requests.RequestException:
        pass


def push(user_id: int, payload: dict) -> None:
    """Pousse un message éphémère (non persisté) à un utilisateur connecté — équivalent de
    l'ancien event_bus.send_to_user() en process, maintenant hébergé par le service core."""
    try:
        requests.post(f"{CORE_URL}/internal/push", json={"user_id": user_id, "payload": payload}, timeout=10)
    except requests.RequestException:
        pass
