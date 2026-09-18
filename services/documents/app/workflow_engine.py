import os
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime
from eth_account import Account
from trustwedge_auth.pii import hash_national_id

from .models import Workflow, WorkflowStatus, WorkflowType, Document, User
from .schemas import DocumentCreate, Attribute
from .services.pdf_generator import generate_document_pdf, generate_land_title_pdf
from . import storage_client
from . import identity_client
from . import notify_client

_PLATFORM_PRIVATE_KEY = os.getenv("PRIVATE_KEY")
_PLATFORM_ACCOUNT = Account.from_key(_PLATFORM_PRIVATE_KEY) if _PLATFORM_PRIVATE_KEY else None


class WorkflowEngine:
    def __init__(self, db: Session, blockchain_client, did_service=None):
        self.db = db
        self.blockchain = blockchain_client
        self.did_service = did_service

    @staticmethod
    def _extract_address(did_or_address: str) -> str:
        prefix = "did:ethr:"
        if did_or_address.startswith(prefix):
            return did_or_address[len(prefix):]
        return did_or_address

    async def issue_document_with_workflow(self, doc, current_user):
        if current_user.get("role") not in ("ISSUER", "VERIFIER", "NOTARY", "ADMIN"):
            raise PermissionError("Only institutional actors can issue documents")
        return await self._issue_document(doc, current_user)

    async def issue_id_card(
        self, owner_did, issuer, first_name=None, last_name=None,
        date_of_birth=None, place_of_birth=None, national_id_number=None,
    ):
        """Émet automatiquement la pièce d'identité (ID_CARD) d'un acteur tout juste créé —
        appelée en HTTP interne par le module identity (cf. routers/internal.py), qui agit
        ici comme autorité d'enregistrement au moment de la création du compte : contrairement
        à issue_document_with_workflow (émission manuelle via le formulaire), on ne recontrôle
        pas son rôle — créer ce DID le lui a déjà implicitement autorisé.

        L'identité civile est reçue en paramètres explicites (valeurs de la requête HTTP
        d'origine, relayées par identity) plutôt que relues depuis la base : ces champs ne
        sont plus persistés nulle part en clair (seul un hash du n° de CNI l'est, côté
        identity) — le hash stocké et le PDF généré ici ne doivent jamais être reliés par une
        valeur en clair commune conservée en base.

        doc_key est le hash du n° de CNI, jamais le n° en clair : le contrat écrit ce champ
        on-chain de façon publique et immuable, un endroit où une PII ne doit jamais figurer."""
        doc = DocumentCreate(
            owner_did=owner_did,
            doc_type="ID_CARD",
            doc_key=hash_national_id(national_id_number) if national_id_number else None,
            attributes=[
                Attribute(key="Nom", value=last_name or "", valueType="string"),
                Attribute(key="Prénom", value=first_name or "", valueType="string"),
                Attribute(key="Date de naissance", value=date_of_birth or "", valueType="string"),
                Attribute(key="Lieu de naissance", value=place_of_birth or "", valueType="string"),
                Attribute(key="N° CNI", value=national_id_number or "", valueType="string"),
            ],
            file_content=b"placeholder",
            filename=f"cni_{national_id_number}.pdf",
            is_transferable=False,
        )
        return await self._issue_document(doc, issuer)

    async def _issue_document(self, doc, current_user):
        owner_address = self._extract_address(doc.owner_did)
        attributes = [a.model_dump() for a in doc.attributes]

        # Résolution des noms (PDF + notification) via le module identity — jamais d'accès
        # direct à la table User ici, cf. routers/internal.py côté identity.
        names_by_address = identity_client.resolve_by_address([owner_address, current_user["address"]])
        owner_identity = names_by_address.get(owner_address)
        issuer_identity = names_by_address.get(current_user["address"])
        owner_name = owner_identity["full_name"] if owner_identity else owner_address
        issuer_name = issuer_identity["full_name"] if issuer_identity else "TrustWedge"

        # Le token_id n'est attribué par le contrat qu'à l'appel blockchain.issue_document
        # plus bas — mais il doit déjà figurer dans le QR code du PDF généré ici, avant
        # l'upload IPFS dont dépend justement cet appel. Le compteur on-chain (_tokenIds)
        # est un simple entier strictement croissant, incrémenté uniquement par
        # issueDocument : on peut donc le prédire de façon fiable à partir du plus grand
        # token_id déjà enregistré côté backend (chaque émission réussie crée une ligne
        # Document juste après avoir minté, cf. plus bas).
        predicted_token_id = (self.db.query(func.max(Document.token_id)).scalar() or 0) + 1

        if doc.doc_type == "LAND_TITLE":
            attrs_by_key = {a["key"]: a["value"] for a in attributes}
            pdf_bytes = generate_land_title_pdf(
                owner_name=owner_name,
                owner_did=doc.owner_did,
                token_id=predicted_token_id,
                location=attrs_by_key.get("location", ""),
                area=attrs_by_key.get("landArea", "0"),
                value=attrs_by_key.get("value", "0"),
                doc_key=doc.doc_key,
            )
        else:
            pdf_bytes = generate_document_pdf(
                doc_type=doc.doc_type,
                doc_key=doc.doc_key,
                owner_name=owner_name,
                owner_did=doc.owner_did,
                attributes=attributes,
                issuer_name=issuer_name,
                token_id=predicted_token_id,
            )
        ipfs_cid = storage_client.upload_file(pdf_bytes, doc.filename)

        # Vérification précoce : le contrat referait de toute façon ce contrôle à
        # l'émission, mais échouer ici donne un message clair et distingue les deux cas
        # que le contrat lui-même distingue :
        #  - même référence (doc_type + doc_key) ET même contenu (même CID) → déjà émis
        #  - même référence mais contenu différent → tentative de modification déguisée
        #    en nouvelle émission, refusée
        if self.blockchain.exists_by_type_and_key(doc.doc_type, doc.doc_key):
            existing = self.blockchain.get_document_by_type_and_key(doc.doc_type, doc.doc_key)
            if existing["ipfsCid"] == ipfs_cid:
                raise ValueError(
                    f"Un document {doc.doc_type} avec la référence '{doc.doc_key}' existe déjà "
                    f"(fichier identique)"
                )
            raise ValueError(
                f"Un document {doc.doc_type} avec la référence '{doc.doc_key}' existe déjà avec "
                f"un contenu différent — modification non autorisée par cette voie"
            )

        # Le contrat exige (1) que le signataire de la transaction soit le titulaire du
        # DID émetteur, et (2) qu'il détienne ISSUER_ROLE on-chain. Seuls les comptes
        # créés avec le rôle ISSUER reçoivent ce rôle on-chain : on ne peut donc signer avec
        # la clé propre de l'utilisateur que dans ce cas précis. Pour VERIFIER/NOTARY/ADMIN —
        # autorisés à émettre côté applicatif mais sans ISSUER_ROLE on-chain — on retombe sur
        # la clé/DID de la plateforme, qui détient ISSUER_ROLE depuis le déploiement.
        signer_key = None
        if current_user.get("role") == "ISSUER" and self.did_service:
            signer_key = self.did_service.get_private_key(current_user["id"], self.db)

        if signer_key:
            issuer_did = f"did:ethr:{current_user['address']}"
        else:
            if not _PLATFORM_ACCOUNT:
                raise ValueError("Aucune clé de signature disponible pour l'émission de document")
            signer_key = _PLATFORM_PRIVATE_KEY
            issuer_did = f"did:ethr:{_PLATFORM_ACCOUNT.address}"

        token_id = self.blockchain.issue_document(
            doc_type=doc.doc_type,
            doc_key=doc.doc_key,
            issuer_did=issuer_did,
            owner=owner_address,
            attributes=attributes,
            ipfs_cid=ipfs_cid,
            is_transferable=doc.is_transferable,
            signer_private_key=signer_key,
        )
        if token_id != predicted_token_id:
            print(f"[WARN] Token ID prédit ({predicted_token_id}) différent du token_id réel ({token_id}) — QR du certificat potentiellement incorrect")

        document = Document(
            token_id=token_id,
            issuer=current_user["address"],
            owner=owner_address,
            doc_type=doc.doc_type,
            doc_key=doc.doc_key,
            ipfs_cid=ipfs_cid,
            is_active=True,
            is_transferable=doc.is_transferable,
            attributes=attributes,
        )
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)

        if owner_identity:
            notify_client.push(owner_identity["id"], {
                "type": "document_issued",
                "token_id": token_id,
                "doc_type": doc.doc_type,
            })

        return {
            "id": document.id,
            "token_id": document.token_id,
            "issuer": document.issuer,
            "owner": document.owner,
            "doc_type": document.doc_type,
            "doc_key": document.doc_key,
            "ipfs_cid": document.ipfs_cid,
            "is_active": document.is_active,
            "is_transferable": document.is_transferable,
            "attributes": document.attributes,
            "created_at": document.created_at,
        }

    def create_workflow(self, workflow_type, initiator_id, target_user_id=None,
                        document_token_id=None, document_cid=None, workflow_data=None):
        workflow = Workflow(
            workflow_type=workflow_type,
            status=WorkflowStatus.PENDING,
            initiator_id=initiator_id,
            target_user_id=target_user_id,
            document_token_id=document_token_id,
            document_cid=document_cid,
            workflow_data=workflow_data or {}
        )
        self.db.add(workflow)
        self.db.commit()
        self.db.refresh(workflow)
        return workflow

    def start_workflow(self, workflow_id, actor_id):
        workflow = self._get_workflow(workflow_id)
        if workflow.initiator_id != actor_id:
            raise PermissionError("Only initiator can start")
        if workflow.status != WorkflowStatus.PENDING:
            raise ValueError(f"Workflow already in {workflow.status}")
        workflow.status = WorkflowStatus.IN_PROGRESS
        self.db.commit()
        return workflow

    def request_verification(self, workflow_id, actor_id, verifier_id, verification_data=None):
        workflow = self._get_workflow(workflow_id)
        if workflow.initiator_id != actor_id:
            raise PermissionError("Only initiator can request verification")
        if workflow.status != WorkflowStatus.IN_PROGRESS:
            raise ValueError(f"Workflow must be IN_PROGRESS")
        workflow.status = WorkflowStatus.AWAITING_VERIFICATION
        workflow.target_user_id = verifier_id
        workflow.workflow_data = {**(workflow.workflow_data or {}), "verification_requested_at": str(datetime.utcnow())}
        self.db.commit()
        return workflow

    def submit_verification(self, workflow_id, actor_id, is_valid, verification_notes=None):
        workflow = self._get_workflow(workflow_id)
        if workflow.workflow_type == WorkflowType.LAND_TRANSFER:
            raise ValueError("Un transfert de titre foncier doit être accepté via /workflows/transfer/accept")
        if workflow.target_user_id != actor_id:
            raise PermissionError("Only designated verifier can submit")
        if workflow.status != WorkflowStatus.AWAITING_VERIFICATION:
            raise ValueError(f"Workflow must be AWAITING_VERIFICATION")
        if not is_valid:
            workflow.status = WorkflowStatus.REJECTED
            workflow.workflow_data = {**(workflow.workflow_data or {}), "rejection_reason": verification_notes}
        else:
            workflow.status = WorkflowStatus.COMPLETED
            workflow.completed_at = datetime.utcnow()
            workflow.workflow_data = {**(workflow.workflow_data or {}), "verified_at": str(datetime.utcnow())}
        self.db.commit()
        return workflow

    def request_notary_validation(self, workflow_id, actor_id, notary_id):
        workflow = self._get_workflow(workflow_id)
        if workflow.initiator_id != actor_id:
            raise PermissionError("Only initiator can request notary")
        if workflow.status != WorkflowStatus.IN_PROGRESS:
            raise ValueError(f"Workflow must be IN_PROGRESS")
        workflow.status = WorkflowStatus.AWAITING_NOTARY
        workflow.notary_id = notary_id
        self.db.commit()
        return workflow

    def validate_by_notary(self, workflow_id, actor_id, is_valid, validation_notes=None, transaction_hash=None):
        workflow = self._get_workflow(workflow_id)
        if workflow.notary_id != actor_id:
            raise PermissionError("Only designated notary can validate")
        if workflow.status != WorkflowStatus.AWAITING_NOTARY:
            raise ValueError(f"Workflow must be AWAITING_NOTARY")
        if not is_valid:
            workflow.status = WorkflowStatus.REJECTED
        else:
            workflow.status = WorkflowStatus.COMPLETED
            workflow.transaction_hash = transaction_hash
            workflow.completed_at = datetime.utcnow()

        self.db.commit()
        return workflow

    def cancel_workflow(self, workflow_id, actor_id, reason="Cancelled by user"):
        workflow = self._get_workflow(workflow_id)
        if workflow.initiator_id != actor_id:
            raise PermissionError("Only initiator can cancel")
        if workflow.status in [WorkflowStatus.COMPLETED, WorkflowStatus.REJECTED]:
            raise ValueError("Workflow already completed")
        workflow.status = WorkflowStatus.CANCELLED
        self.db.commit()
        return workflow

    def get_workflow(self, workflow_id):
        return self._get_workflow(workflow_id)

    def get_user_workflows(self, user_id, status: Optional[str] = None):
        query = self.db.query(Workflow).filter(
            (Workflow.initiator_id == user_id)
            | (Workflow.target_user_id == user_id)
            | (Workflow.notary_id == user_id)
        )
        if status:
            query = query.filter(Workflow.status == status)
        return query.order_by(Workflow.created_at.desc()).all()

    def _get_workflow(self, workflow_id):
        workflow = self.db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")
        return workflow
