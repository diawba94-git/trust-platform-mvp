import re
from typing import Dict

from .ocr_service import extract_text

# Réel (Tesseract, cf. ocr_service.extract_text) — même approche best-effort par regex que
# extract_land_title_fields : un champ non trouvé reste vide, l'utilisateur corrige à la main
# avant de valider (cf. Étape 3 de l'onboarding KYC du wallet).
_NOM_RE = re.compile(r"NOM\s*[:\-]?\s*([A-ZÀ-Ü][\wÀ-ÿ' \-]{1,40})", re.IGNORECASE)
_PRENOM_RE = re.compile(r"PR[EÉ]NOM(?:S)?\s*[:\-]?\s*([A-ZÀ-Ü][\wÀ-ÿ' \-]{1,40})", re.IGNORECASE)
_DATE_RE = re.compile(r"(\d{2}[/\-.]\d{2}[/\-.]\d{4})")
_CNI_RE = re.compile(r"\b(\d{7,13})\b")
_NATIONALITE_RE = re.compile(r"NATIONALIT[EÉ]\s*[:\-]?\s*([A-ZÀ-Ü][\wÀ-ÿ' \-]{2,30})", re.IGNORECASE)


def extract_id_card_fields(content: bytes, filename: str = "id_card.jpg") -> Dict[str, str]:
    text = extract_text(content, filename)

    nom_match = _NOM_RE.search(text)
    prenom_match = _PRENOM_RE.search(text)
    date_match = _DATE_RE.search(text)
    cni_match = _CNI_RE.search(text)
    nat_match = _NATIONALITE_RE.search(text)

    return {
        "nom": nom_match.group(1).strip() if nom_match else "",
        "prenom": prenom_match.group(1).strip() if prenom_match else "",
        "date_naissance": date_match.group(1) if date_match else "",
        "num_cni": cni_match.group(1) if cni_match else "",
        "nationalite": nat_match.group(1).strip() if nat_match else "",
    }
