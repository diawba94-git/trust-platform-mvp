import hashlib


def hash_national_id(value: str) -> str:
    """Hash déterministe (SHA-256) du n° de carte d'identité — valeur normalisée (espaces
    superflus retirés, mise en majuscules) avant hachage pour qu'une même personne produise
    toujours le même hash quelle que soit la saisie. Utilisé pour la déduplication d'identité
    (find_existing_person côté module identity) sans jamais conserver le CNI en clair."""
    normalized = value.strip().upper()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
