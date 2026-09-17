from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum


class WorkflowStatus(enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    AWAITING_VERIFICATION = "AWAITING_VERIFICATION"
    AWAITING_NOTARY = "AWAITING_NOTARY"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class WorkflowType(enum.Enum):
    EMPLOYMENT_VERIFICATION = "EMPLOYMENT_VERIFICATION"
    DIPLOMA_VERIFICATION = "DIPLOMA_VERIFICATION"
    LAND_TRANSFER = "LAND_TRANSFER"
    LOAN_APPLICATION = "LOAN_APPLICATION"
    ID_CARD_ISSUANCE = "ID_CARD_ISSUANCE"


class User(Base):
    """Projection locale — exchange ne modifie jamais cette table, seulement des lectures
    (retrouver un acheteur par email, un notaire par rôle, déchiffrer sa propre clé privée
    pour signer une transaction blockchain localement)."""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    did = Column(String, unique=True, index=True)
    address = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    role = Column(String)
    private_key_encrypted = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)


class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(Integer, primary_key=True, index=True)
    workflow_type = Column(Enum(WorkflowType), nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.PENDING)
    initiator_id = Column(Integer, ForeignKey("users.id"))
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notary_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    document_token_id = Column(Integer, nullable=True)
    document_cid = Column(String, nullable=True)
    workflow_data = Column(JSON, default=dict)
    transaction_hash = Column(String, nullable=True)
    seller_signature = Column(String, nullable=True)
    buyer_signature = Column(String, nullable=True)
    notary_signature = Column(String, nullable=True)
    transfer_request_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class DocumentShare(Base):
    __tablename__ = "document_shares"
    id = Column(Integer, primary_key=True, index=True)
    share_token = Column(String, unique=True, index=True)
    token_id = Column(Integer, index=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    access_level = Column(String, default="view")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
