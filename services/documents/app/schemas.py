from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class Attribute(BaseModel):
    key: str
    value: str
    valueType: str


class DocumentCreate(BaseModel):
    owner_did: str
    doc_type: str
    doc_key: str
    attributes: List[Attribute]
    file_content: bytes
    filename: str
    is_transferable: bool = False


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


class IssueIdCardInternalRequest(BaseModel):
    owner_did: str
    issuer_id: int
    issuer_role: str
    issuer_address: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    place_of_birth: Optional[str] = None
    national_id_number: Optional[str] = None
