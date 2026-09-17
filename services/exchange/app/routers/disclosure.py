from datetime import datetime, timezone

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import APIRouter, HTTPException

from ..schemas import SelectiveDisclosureRequest, SelectiveDisclosureVerifyResponse
from ..blockchain import BlockchainClient
from .. import documents_client
from .. import identity_client

router = APIRouter(prefix="/documents", tags=["Selective Disclosure"])

blockchain_client = BlockchainClient()

_PROOF_TTL_MS = 5 * 60 * 1000
_CLOCK_SKEW_TOLERANCE_MS = 60 * 1000


def build_canonical_message(token_id: int, owner: str, fields: list, timestamp: int) -> str:
    """Doit produire EXACTEMENT la même chaîne que selectiveDisclosureService.ts côté wallet."""
    fields_part = ",".join(f"{f.key}={f.value}" for f in fields)
    return f"{token_id}|{owner.lower()}|{timestamp}|{fields_part}"


@router.post("/verify-shared", response_model=SelectiveDisclosureVerifyResponse)
async def verify_shared_document(payload: SelectiveDisclosureRequest):
    """Vérifie une preuve de divulgation sélective générée par ShareScreen.tsx (wallet) : un
    sous-ensemble des champs d'un document, signé par son propriétaire. Public — c'est un
    tiers (banque, employeur, ...) qui scanne ce QR, pas forcément un compte TrustWedge.

    Trois garanties, dans l'ordre : fraîcheur, authenticité, intégrité."""
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

    status = documents_client.get_status(payload.token_id)
    names = identity_client.resolve_by_address([doc["owner"], doc["issuer"]])
    owner_identity = names.get(doc["owner"])
    issuer_identity = names.get(doc["issuer"])

    real_attrs = {a["key"]: str(a["value"]) for a in (status.get("attributes") or [])}
    synthetic_fields = {
        "owner_name": owner_identity["full_name"] if owner_identity else None,
        "doc_key": status.get("doc_key") if status.get("found") else None,
        "issuer_name": issuer_identity["full_name"] if issuer_identity else None,
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
        doc_key=status.get("doc_key") if status.get("found") else None,
        owner_name=owner_identity["full_name"] if owner_identity else None,
        fields=payload.fields,
        verified_at=datetime.now(timezone.utc),
    )
