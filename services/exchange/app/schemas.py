from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime


class TransferInitiateRequest(BaseModel):
    token_id: int
    buyer_email: EmailStr


class TransferAcceptRequest(BaseModel):
    workflow_id: int


class TransferFinalizeRequest(BaseModel):
    workflow_id: int
    notes: Optional[str] = None


class ShareCreateRequest(BaseModel):
    token_id: int
    access_level: str = "view"
    expires_in_days: Optional[int] = 7


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


class DisclosedField(BaseModel):
    key: str
    label: str
    value: str


class SelectiveDisclosureRequest(BaseModel):
    token_id: int
    owner: str
    fields: List[DisclosedField]
    timestamp: int
    signature: str


class SelectiveDisclosureVerifyResponse(BaseModel):
    valid: bool
    doc_type: str
    doc_key: Optional[str] = None
    owner_name: Optional[str] = None
    fields: List[DisclosedField]
    verified_at: datetime
