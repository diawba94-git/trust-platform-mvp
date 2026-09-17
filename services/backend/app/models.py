from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey, Enum, UniqueConstraint
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


class UserRole(enum.Enum):
    ADMIN = "ADMIN"
    ISSUER = "ISSUER"
    VERIFIER = "VERIFIER"
    BANK = "BANK"
    NOTARY = "NOTARY"
    USER = "USER"


# Rôles applicatifs qui correspondent à un rôle AccessControl sur le contrat
# (ADMIN/USER n'ont pas de rôle on-chain dédié). Partagé entre la création d'acteur
# et la régénération de clé, pour que les deux accordent/retirent le même rôle.
# BANK partage VERIFIER_ROLE on-chain (même capacité de vérification que VERIFIER ;
# le contrat n'a pas de notion de "banque" — seule la couche applicative distingue les
# deux pour l'éligibilité aux demandes de prêt).
ROLE_TO_CONTRACT_ROLE = {
    UserRole.ISSUER: "ISSUER_ROLE",
    UserRole.VERIFIER: "VERIFIER_ROLE",
    UserRole.BANK: "VERIFIER_ROLE",
    UserRole.NOTARY: "NOTARY_ROLE",
}


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    did = Column(String, unique=True, index=True)
    address = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    role = Column(String)
    private_key_encrypted = Column(String, nullable=True)
    public_key = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Identité civile — sert de clé de rapprochement lors d'une nouvelle création de DID
    # (cf. UserAffiliation) pour éviter qu'un même individu se retrouve avec plusieurs DID
    # selon l'acteur qui le crée (admin, université, ...). national_id_number est nullable
    # pour ne pas casser les comptes existants créés avant l'introduction de ces champs.
    date_of_birth = Column(String, nullable=True)
    place_of_birth = Column(String, nullable=True)
    national_id_number = Column(String, unique=True, index=True, nullable=True)


class UserAffiliation(Base):
    """Rattachement d'une personne déjà identifiée (DID existant, créé par un premier acteur,
    ex. l'Admin) à un autre acteur (ex. une université) qui a besoin de la retrouver dans son
    propre périmètre — pour lui délivrer un diplôme, une attestation, etc. — sans dupliquer son
    DID. Distinct de User.created_by (qui reste le créateur d'origine, non modifié) : une même
    personne peut être rattachée à plusieurs institutions au fil du temps."""
    __tablename__ = "user_affiliations"
    __table_args__ = (
        UniqueConstraint("user_id", "institution_id", name="uq_user_affiliations_user_institution"),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    institution_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("doc_type", "doc_key", name="uq_documents_doc_type_doc_key"),
    )
    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(Integer, unique=True, index=True)
    issuer = Column(String, ForeignKey("users.address"))
    owner = Column(String)
    doc_type = Column(String)
    doc_key = Column(String)  # Référence métier unique au sein du doc_type (ex: n° de titre foncier)
    ipfs_cid = Column(String)
    is_active = Column(Boolean, default=True)
    is_transferable = Column(Boolean, default=False)
    attributes = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Invitation(Base):
    __tablename__ = "invitations"
    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"))
    to_user_id = Column(Integer, ForeignKey("users.id"))
    token_id = Column(Integer)
    message = Column(String)
    status = Column(String, default="PENDING")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True), nullable=True)


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
    # Vente entre particuliers (LAND_TRANSFER) : triple signature vendeur/acheteur/notaire.
    seller_signature = Column(String, nullable=True)
    buyer_signature = Column(String, nullable=True)
    notary_signature = Column(String, nullable=True)
    transfer_request_hash = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    steps = relationship(
        "WorkflowStep",
        backref="workflow",
        order_by="WorkflowStep.created_at",
        cascade="all, delete-orphan",
    )


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"))
    step_name = Column(String, nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)
    status = Column(String, default="PENDING")
    step_data = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DocumentShare(Base):
    """Lien de partage d'un document, généré par son propriétaire depuis le wallet mobile
    (écran "Partages"). Le lien ne fait foi de rien par lui-même : la résolution publique
    (GET /shares/{share_token}) relit toujours l'état réel du document on-chain avant de le
    renvoyer, et refuse si le lien est révoqué ou expiré."""
    __tablename__ = "document_shares"
    id = Column(Integer, primary_key=True, index=True)
    share_token = Column(String, unique=True, index=True)
    token_id = Column(Integer, index=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    # "view" : consultation seule des métadonnées/statut. "download" : autorise aussi le PDF.
    access_level = Column(String, default="view")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KycStatus(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class KycVerification(Base):
    """Dossier KYC soumis par le wallet mobile à l'issue de son parcours de vérification
    (OTP téléphone/email, OCR carte d'identité, reconnaissance faciale — cf. routers/verification.py,
    volontairement sans état). Ce modèle, lui, persiste le résultat pour permettre une vraie
    revue humaine côté Banque/Notaire (files "Demandes KYC" des tableaux de bord)."""
    __tablename__ = "kyc_verifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    full_name = Column(String)
    id_card_number = Column(String, nullable=True)
    id_card_data = Column(JSON, default=dict)
    phone_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    face_match_passed = Column(Boolean, default=False)
    status = Column(Enum(KycStatus), default=KycStatus.PENDING)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    type = Column(String)
    message = Column(String)
    workflow_id = Column(Integer, nullable=True)
    token_id = Column(Integer, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
