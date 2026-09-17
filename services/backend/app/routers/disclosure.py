from datetime import datetime, timezone

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, User
from ..schemas import SelectiveDisclosureRequest, SelectiveDisclosureVerifyResponse
from ..blockchain import BlockchainClient

router = APIRouter(prefix="/documents", tags=["Selective Disclosure"])

blockchain_client = BlockchainClient()

# Durée de validité d'une preuve de divulgation sélective — au-delà, le QR doit être régénéré.
# Empêche la réutilisation d'un QR capturé en photo/capture d'écran longtemps après coup.
_PROOF_TTL_MS = 5 * 60 * 1000
# Tolérance sur une horloge client légèrement en avance.
_CLOCK_SKEW_TOLERANCE_MS = 60 * 1000


def build_canonical_message(token_id: int, owner: str, fields: list, timestamp: int) -> str:
    """Doit produire EXACTEMENT la même chaîne que selectiveDisclosureService.ts côté wallet —
    ni JSON.stringify ni json.dumps ne garantissent un ordre/espacement identique entre JS et
    Python, d'où une construction manuelle explicite plutôt qu'une sérialisation générique."""
    fields_part = ",".join(f"{f.key}={f.value}" for f in fields)
    return f"{token_id}|{owner.lower()}|{timestamp}|{fields_part}"


@router.post("/verify-shared", response_model=SelectiveDisclosureVerifyResponse)
async def verify_shared_document(
    payload: SelectiveDisclosureRequest,
    db: Session = Depends(get_db),
):
    """
    Vérifie une preuve de divulgation sélective générée par ShareScreen.tsx (wallet) : un
    sous-ensemble des champs d'un document, signé par son propriétaire. Public — c'est un
    tiers (banque, employeur, ...) qui scanne ce QR, pas forcément un compte TrustWedge.

    Trois garanties, dans l'ordre :
    1. Fraîcheur — la preuve expire 5 minutes après sa génération.
    2. Authenticité — la signature doit provenir de `owner`.
    3. Intégrité — chaque champ divulgué doit correspondre à la valeur réellement enregistrée
       (empêche de divulguer une valeur falsifiée, ex: une valeur foncière gonflée/réduite).
    """
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    age_ms = now_ms - payload.timestamp
    if age_ms > _PROOF_TTL_MS:
        raise HTTPException(status_code=410, detail="Preuve expirée — demandez un nouveau QR code au propriétaire.")
    if age_ms < -_CLOCK_SKEW_TOLERANCE_MS:
        raise HTTPException(status_code=400, detail="Horodatage de la preuve invalide.")

    canonical = build_canonical_message(payload.token_id, payload.owner, payload.fields, payload.timestamp)
    try:
        recovered = Account.recover_message(encode_defunct(text=canonical), signature=payload.signature)
    except Exception:
        raise HTTPException(status_code=400, detail="Signature illisible.")

    if recovered.lower() != payload.owner.lower():
        raise HTTPException(status_code=400, detail="La signature ne correspond pas au propriétaire déclaré.")

    doc = blockchain_client.verify_document(payload.token_id)
    if not doc["isValid"]:
        raise HTTPException(status_code=409, detail="Ce document n'est plus valide (révoqué).")
    if doc["owner"].lower() != payload.owner.lower():
        raise HTTPException(status_code=409, detail="Ce document n'appartient plus au signataire déclaré.")

    local_document = db.query(Document).filter(Document.token_id == payload.token_id).first()
    owner_user = db.query(User).filter(User.address == doc["owner"]).first()
    issuer_user = db.query(User).filter(User.address == doc["issuer"]).first()

    # Champs réels tirés des attributs on-chain/DB (location, valeur, salaire, ...) + champs
    # "synthétiques" affichés par ShareScreen (propriétaire, référence, émetteur) qui ne sont
    # pas dans `attributes` mais doivent être tout autant protégés contre une falsification.
    real_attrs = {a["key"]: str(a["value"]) for a in (local_document.attributes if local_document else [])}
    synthetic_fields = {
        "owner_name": owner_user.full_name if owner_user else None,
        "doc_key": local_document.doc_key if local_document else None,
        "issuer_name": issuer_user.full_name if issuer_user else None,
    }

    mismatches = []
    for f in payload.fields:
        if f.key in real_attrs and real_attrs[f.key] != f.value:
            mismatches.append(f.key)
        elif f.key in synthetic_fields and synthetic_fields[f.key] is not None and synthetic_fields[f.key] != f.value:
            mismatches.append(f.key)
    if mismatches:
        raise HTTPException(
            status_code=409,
            detail=f"Champ(s) falsifié(s) détecté(s) : {', '.join(mismatches)} ne correspond(ent) pas à la blockchain.",
        )

    return SelectiveDisclosureVerifyResponse(
        valid=True,
        doc_type=doc["docType"],
        doc_key=local_document.doc_key if local_document else None,
        owner_name=owner_user.full_name if owner_user else None,
        fields=payload.fields,
        verified_at=datetime.now(timezone.utc),
    )
