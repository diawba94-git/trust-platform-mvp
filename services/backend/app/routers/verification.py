import base64

from fastapi import APIRouter, HTTPException

from ..schemas import (
    PhoneSendRequest,
    PhoneSendResponse,
    PhoneVerifyRequest,
    VerificationResult,
    EmailSendRequest,
    EmailSendResponse,
    EmailVerifyRequest,
    IdCardExtractRequest,
    IdCardExtractResponse,
    FaceCompareRequest,
    FaceCompareResponse,
)
from ..services import verification_service
from ..services.id_card_ocr_service import extract_id_card_fields
from ..services.face_match_service import compare_faces_mock

router = APIRouter(prefix="/verification", tags=["Verification (KYC)"])

# Public, sans authentification : ces étapes font partie de l'onboarding, avant qu'un JWT
# n'existe. Le contrôle "on ne stocke rien" (base ou blockchain) est volontaire pour cette
# première passe — le résultat reste côté client (cf. apps/wallet/src/screens/KycVerificationScreen.tsx).


@router.post("/phone/send", response_model=PhoneSendResponse)
def send_phone_code(request: PhoneSendRequest):
    token, code = verification_service.generate_phone_code(request.phone)
    return PhoneSendResponse(token=token, dev_code=code)


@router.post("/phone/verify", response_model=VerificationResult)
def verify_phone(request: PhoneVerifyRequest):
    return VerificationResult(verified=verification_service.verify_phone_code(request.token, request.code))


@router.post("/email/send", response_model=EmailSendResponse)
def send_email_verification(request: EmailSendRequest):
    return EmailSendResponse(token=verification_service.generate_email_token(request.email))


@router.post("/email/verify", response_model=VerificationResult)
def verify_email(request: EmailVerifyRequest):
    return VerificationResult(verified=verification_service.verify_email_token(request.token))


@router.post("/id-card/extract", response_model=IdCardExtractResponse)
def extract_id_card(request: IdCardExtractRequest):
    try:
        content = base64.b64decode(request.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Image invalide (base64 attendu)")

    fields = extract_id_card_fields(content)
    return IdCardExtractResponse(**fields)


@router.post("/face/compare", response_model=FaceCompareResponse)
def compare_faces(request: FaceCompareRequest):
    result = compare_faces_mock(request.card_image_base64, request.selfie_image_base64)
    return FaceCompareResponse(**result)
