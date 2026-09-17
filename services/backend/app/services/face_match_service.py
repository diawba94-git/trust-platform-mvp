import hashlib
from typing import Dict

_SIMILARITY_THRESHOLD = 60.0


def compare_faces_mock(card_image_base64: str, selfie_image_base64: str) -> Dict:
    """MOCK — aucune reconnaissance faciale réelle : intégrer une vraie comparaison (ex:
    face_recognition/dlib, ou un service cloud comme AWS Rekognition/Azure Face) nécessite une
    dépendance native lourde à compiler, hors périmètre de cette première passe. Renvoie un
    score simulé mais déterministe (dérivé du contenu des deux images, pas aléatoire à chaque
    appel) pour que le comportement reste stable en test/démo. Ne compare RIEN réellement — à
    remplacer avant toute mise en production."""
    if not card_image_base64 or not selfie_image_base64:
        return {"matched": False, "similarity": 0.0, "mocked": True}

    digest = hashlib.sha256((card_image_base64[:200] + selfie_image_base64[:200]).encode()).hexdigest()
    simulated_similarity = 85.0 + (int(digest[:4], 16) % 1300) / 100.0  # ~85.00–97.99 %

    return {
        "matched": simulated_similarity >= _SIMILARITY_THRESHOLD,
        "similarity": round(simulated_similarity, 2),
        "mocked": True,
    }
