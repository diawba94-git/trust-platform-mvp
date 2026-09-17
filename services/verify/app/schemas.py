from pydantic import BaseModel
from typing import List, Optional


class Attribute(BaseModel):
    key: str
    value: str
    valueType: str


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
