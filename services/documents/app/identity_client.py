import os
import requests

IDENTITY_URL = os.getenv("IDENTITY_SERVICE_URL", "http://identity:8000")


def resolve_by_address(addresses) -> dict:
    """Résout une liste d'adresses blockchain vers {id, full_name, email, did} — jamais de
    lecture directe de la table User pour cette information, cf. module identity."""
    addresses = [a for a in addresses if a]
    if not addresses:
        return {}
    response = requests.get(
        f"{IDENTITY_URL}/internal/identity/by-address",
        params={"addresses": ",".join(addresses)},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()
