import io
import re
from typing import Dict, List

import pytesseract
from PIL import Image


def _load_images(content: bytes, filename: str) -> List[Image.Image]:
    if filename.lower().endswith(".pdf"):
        from pdf2image import convert_from_bytes
        return convert_from_bytes(content, dpi=200)
    return [Image.open(io.BytesIO(content))]


def extract_text(content: bytes, filename: str) -> str:
    """OCR (Tesseract, français) sur un fichier image ou PDF (première page suffit
    généralement pour un certificat de titre foncier)."""
    images = _load_images(content, filename)
    texts = [pytesseract.image_to_string(img, lang="fra") for img in images[:1]]
    return "\n".join(texts)


_DOC_KEY_RE = re.compile(r"\bTF[\s\-/]?\d{2,4}[\s\-/]?\d{2,6}(?:[\s\-/]?\d{1,4})?\b", re.IGNORECASE)
_AREA_RE = re.compile(r"(\d[\d\s]{0,9})\s*m\s*[²2]", re.IGNORECASE)
_VALUE_RE = re.compile(r"(\d[\d\s.]{2,15})\s*(?:FCFA|F\s*CFA|XOF)", re.IGNORECASE)
_LOCATION_RE = re.compile(
    r"(?:localisation|ville|r[ée]gion|adresse)\s*[:\-]?[ \t]*([A-ZÀ-Ü][\wÀ-ÿ \t\-,]{2,50})",
    re.IGNORECASE,
)


def extract_land_title_fields(text: str) -> Dict[str, str]:
    """Extraction heuristique (regex) des champs d'un titre foncier à partir du texte
    reconnu par l'OCR. Best-effort : les champs non trouvés restent vides — l'admin les
    complète/corrige lors de l'étape de vérification avant validation."""
    doc_key_match = _DOC_KEY_RE.search(text)
    area_match = _AREA_RE.search(text)
    value_match = _VALUE_RE.search(text)
    location_match = _LOCATION_RE.search(text)

    return {
        "doc_key": re.sub(r"[\s/]", "-", doc_key_match.group(0).upper()).strip("-") if doc_key_match else "",
        "land_area": re.sub(r"\s", "", area_match.group(1)) if area_match else "",
        "value": re.sub(r"[\s.]", "", value_match.group(1)) if value_match else "",
        "location": location_match.group(1).split("\n")[0].strip() if location_match else "",
    }
