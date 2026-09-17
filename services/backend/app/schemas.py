from pydantic import BaseModel, EmailStr, model_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

from .models import UserRole


class Attribute(BaseModel):
    key: str
    value: str
    valueType: str


# ============================================================
# Users
# ============================================================
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "USER"
    address: str


class UserOut(BaseModel):
    id: int
    did: str
    address: Optional[str] = None
    public_key: Optional[str] = None
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ============================================================
# Documents
# ============================================================
class DocumentCreate(BaseModel):
    owner_did: str
    doc_type: str
    doc_key: str  # Référence métier unique au sein du doc_type (ex: n° de titre foncier)
    attributes: List[Attribute]
    file_content: bytes
    filename: str
    is_transferable: bool = False


class DocumentOut(BaseModel):
    id: int
    token_id: int
    issuer: str
    owner: str
    doc_type: str
    doc_key: Optional[str] = None
    ipfs_cid: str
    is_active: bool
    is_transferable: bool
    attributes: List[Attribute]
    created_at: datetime


# ============================================================
# Workflows
# ============================================================
class WorkflowCreateRequest(BaseModel):
    workflow_type: str
    target_user_id: Optional[int] = None
    document_token_id: Optional[int] = None
    document_cid: Optional[str] = None
    workflow_data: Optional[Dict[str, Any]] = None


class VerificationRequest(BaseModel):
    verifier_id: int
    verification_data: Optional[Dict[str, Any]] = None


class VerificationSubmit(BaseModel):
    is_valid: bool
    notes: Optional[str] = None


class NotaryRequest(BaseModel):
    notary_id: int


class NotaryValidation(BaseModel):
    is_valid: bool
    notes: Optional[str] = None
    transaction_hash: Optional[str] = None


class CancelRequest(BaseModel):
    reason: str = "Cancelled by user"


# ============================================================
# Admin / DID
# ============================================================
class ActorCreateRequest(BaseModel):
    # Identité civile — exigée uniquement pour un compte USER (citoyen) : elle sert de clé
    # de rapprochement pour éviter de dupliquer son DID. Un compte institutionnel (ISSUER,
    # VERIFIER, BANK, NOTARY) représente une organisation, pas une personne à identifier ainsi.
    email: EmailStr
    full_name: str
    # Nom/prénom séparés — saisis en plus de full_name pour alimenter distinctement les
    # champs "Nom"/"Prénom" de la pièce d'identité (ID_CARD) auto-émise avec le DID (voir
    # WorkflowEngine.issue_id_card) ; full_name reste la source pour User.full_name.
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    national_id_number: Optional[str] = None
    role: UserRole = UserRole.USER

    @model_validator(mode="after")
    def _require_identity_fields_for_user_role(self):
        if self.role == UserRole.USER and not (self.date_of_birth and self.place_of_birth and self.national_id_number):
            raise ValueError(
                "date_of_birth, place_of_birth et national_id_number sont requis pour créer un compte USER"
            )
        return self


class ActorCreateResponse(BaseModel):
    id: int
    did: str
    address: str
    # None quand le compte existait déjà (rattachement) : la clé privée a été transmise une
    # seule fois, à son créateur d'origine — on ne la renvoie pas une seconde fois à un autre acteur.
    private_key: Optional[str] = None
    public_key: str
    email: str
    full_name: str
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    national_id_number: Optional[str] = None
    role: str
    created_at: datetime
    # True si un DID existait déjà pour cette personne (email ou n° de carte d'identité déjà
    # connu) et qu'elle a simplement été rattachée à l'acteur appelant, sans nouveau DID généré.
    already_existed: bool = False

    class Config:
        from_attributes = True


class MyCredentialsResponse(BaseModel):
    id: int
    did: str
    address: str
    private_key: Optional[str] = None
    public_key: Optional[str] = None
    email: str
    full_name: str
    role: str

    class Config:
        from_attributes = True


# ============================================================
# Historique des documents
# ============================================================
class VersionResponse(BaseModel):
    version_index: int
    cid: str
    owner: str
    owner_name: Optional[str] = None
    timestamp: int
    is_current: bool


class DocumentHistoryResponse(BaseModel):
    token_id: int
    doc_type: str
    doc_key: Optional[str] = None
    current_owner: str
    current_owner_name: Optional[str] = None
    current_owner_did: Optional[str] = None
    is_active: bool = True
    is_transferable: bool = False
    attributes: List[Attribute] = []
    versions: List[VersionResponse]


# ============================================================
# Vente entre particuliers (triple signature)
# ============================================================
class TransferInitiateRequest(BaseModel):
    token_id: int
    buyer_email: EmailStr


class TransferAcceptRequest(BaseModel):
    workflow_id: int


class TransferFinalizeRequest(BaseModel):
    workflow_id: int
    notes: Optional[str] = None


# ============================================================
# Notifications
# ============================================================
class NotificationOut(BaseModel):
    id: int
    type: str
    message: str
    workflow_id: Optional[int] = None
    token_id: Optional[int] = None
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Invitations
# ============================================================
class InvitationCreate(BaseModel):
    to_user_id: int
    token_id: Optional[int] = None
    message: str


class InvitationResponse(BaseModel):
    invitation_id: int
    status: str


# ============================================================
# Vérification d'identité (KYC) — wallet mobile, onboarding SSI
# Téléphone/email : logique de vérification réelle (JWT à expiration), mais l'envoi
# (SMS/email) est mocké — cf. services/verification_service.py. OCR carte d'identité : réel
# (Tesseract, déjà utilisé pour les titres fonciers). Reconnaissance faciale : mockée
# (cf. services/face_match_service.py) — aucune dépendance de reconnaissance faciale installée.
# ============================================================
class PhoneSendRequest(BaseModel):
    phone: str


class PhoneSendResponse(BaseModel):
    token: str
    # Uniquement parce que l'envoi SMS est mocké (pas de Twilio branché) : en conditions
    # réelles, le code ne doit JAMAIS transiter par cette réponse HTTP, seul le SMS le porte.
    dev_code: Optional[str] = None


class PhoneVerifyRequest(BaseModel):
    token: str
    code: str


class VerificationResult(BaseModel):
    verified: bool


class EmailSendRequest(BaseModel):
    email: EmailStr


class EmailSendResponse(BaseModel):
    token: str


class EmailVerifyRequest(BaseModel):
    token: str


class IdCardExtractRequest(BaseModel):
    image_base64: str


class IdCardExtractResponse(BaseModel):
    nom: str
    prenom: str
    date_naissance: str
    num_cni: str
    nationalite: str


class FaceCompareRequest(BaseModel):
    card_image_base64: str
    selfie_image_base64: str


class FaceCompareResponse(BaseModel):
    matched: bool
    similarity: float
    mocked: bool = True


# ============================================================
# Partage de document par lien (wallet mobile — écran "Partages")
# ============================================================
class ShareCreateRequest(BaseModel):
    token_id: int
    access_level: str = "view"  # "view" | "download"
    expires_in_days: Optional[int] = 7  # null = pas d'expiration


class ShareOut(BaseModel):
    id: int
    share_token: str
    token_id: int
    doc_type: Optional[str] = None
    doc_key: Optional[str] = None
    access_level: str
    expires_at: Optional[datetime] = None
    revoked: bool
    created_at: datetime


class ShareResolveResponse(BaseModel):
    isValid: bool
    docType: str
    docKey: Optional[str] = None
    owner_name: Optional[str] = None
    issuer_name: Optional[str] = None
    access_level: str
    can_download: bool


# ============================================================
# Divulgation sélective (wallet mobile — ShareScreen)
# ============================================================
class DisclosedField(BaseModel):
    key: str
    label: str
    value: str


class SelectiveDisclosureRequest(BaseModel):
    token_id: int
    owner: str
    fields: List[DisclosedField]
    timestamp: int  # epoch ms, au moment de la signature côté wallet
    signature: str


class SelectiveDisclosureVerifyResponse(BaseModel):
    valid: bool
    doc_type: str
    doc_key: Optional[str] = None
    owner_name: Optional[str] = None
    fields: List[DisclosedField]
    verified_at: datetime


class ManagedUserCreateRequest(BaseModel):
    """Création d'un compte géré par un ISSUER (étudiant, toujours USER), un BANK (client,
    toujours USER) ou un VERIFIER (employé USER, ou un autre représentant VERIFIER de la
    même entreprise) — jamais un rôle hors de cet ensemble restreint, contrairement à
    POST /admin/actors/create. Identité civile (date/lieu de naissance, CNI) exigée
    uniquement pour un compte USER — voir ActorCreateRequest."""
    email: EmailStr
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    national_id_number: Optional[str] = None
    role: str = "USER"

    @model_validator(mode="after")
    def _require_identity_fields_for_user_role(self):
        if self.role == "USER" and not (self.date_of_birth and self.place_of_birth and self.national_id_number):
            raise ValueError(
                "date_of_birth, place_of_birth et national_id_number sont requis pour créer un compte USER"
            )
        return self


class KycSubmitRequest(BaseModel):
    full_name: str
    id_card_number: Optional[str] = None
    id_card_data: Dict[str, Any] = {}
    phone_verified: bool = False
    email_verified: bool = False
    face_match_passed: bool = False


class KycOut(BaseModel):
    id: int
    user_id: int
    full_name: str
    id_card_number: Optional[str] = None
    phone_verified: bool
    email_verified: bool
    face_match_passed: bool
    status: str
    reviewer_notes: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class KycReviewRequest(BaseModel):
    approve: bool
    notes: Optional[str] = None
