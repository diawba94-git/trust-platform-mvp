from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

from .database import engine, get_db, SessionLocal, run_light_migrations
from .models import Base, User, Document, UserAffiliation
from .schemas import *
from .auth import get_current_user, register_user, login_user
from .blockchain import BlockchainClient
from .ipfs_utils import IPFSClient
from .workflow_engine import WorkflowEngine
from .shared import event_bus
from .services.did_service import DIDService
from .routers import (
    actors as actors_router,
    admin as admin_router,
    did as did_router,
    disclosure as disclosure_router,
    documents as documents_router,
    kyc as kyc_router,
    notifications as notifications_router,
    shares as shares_router,
    stats as stats_router,
    transfers as transfers_router,
    verification as verification_router,
)

Base.metadata.create_all(bind=engine)
run_light_migrations()

blockchain_client = BlockchainClient()
ipfs_client = IPFSClient()
did_service = DIDService(os.getenv("ENCRYPTION_KEY"))

app = FastAPI(title="TrustWedge API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(actors_router.router)
app.include_router(admin_router.router)
app.include_router(did_router.router)
app.include_router(disclosure_router.router)
app.include_router(documents_router.router)
app.include_router(kyc_router.router)
app.include_router(notifications_router.router)
app.include_router(shares_router.router)
app.include_router(stats_router.router)
app.include_router(transfers_router.router)
app.include_router(verification_router.router)

@app.exception_handler(PermissionError)
async def permission_error_handler(request: Request, exc: PermissionError):
    return JSONResponse(status_code=403, content={"detail": str(exc)})

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

# ============================================================
# Health Check
# ============================================================
@app.get("/")
def root():
    return {"message": "TrustWedge API", "status": "running", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ============================================================
# WebSocket
# ============================================================
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    try:
        await event_bus.connect(user_id, websocket)
        await event_bus.manager.send_to_user(user_id, {
            "type": "connected",
            "message": "Connected to TrustWedge event bus"
        })
        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
    except WebSocketDisconnect:
        pass
    finally:
        event_bus.disconnect(user_id, websocket)

# ============================================================
# Auth
# ============================================================
@app.post("/auth/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    return register_user(db, user)

@app.post("/auth/login")
def login(form_data: LoginRequest, db: Session = Depends(get_db)):
    return login_user(db, form_data)

# ============================================================
# Documents
# ============================================================
@app.post("/documents/issue")
async def issue_document(
    doc: DocumentCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus, did_service)
    return await engine.issue_document_with_workflow(doc, current_user)

@app.get("/documents/verify/{token_id}")
def verify_document(token_id: int, db: Session = Depends(get_db)):
    result = blockchain_client.verify_document(token_id)
    owner_user = db.query(User).filter(User.address == result["owner"]).first()
    issuer_user = db.query(User).filter(User.address == result["issuer"]).first()
    result["owner_name"] = owner_user.full_name if owner_user else None
    result["issuer_name"] = issuer_user.full_name if issuer_user else None
    return result

@app.get("/documents/my")
def get_my_documents(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    documents = db.query(Document).filter(Document.owner == current_user["address"]).order_by(Document.created_at.desc()).all()
    issuer_addresses = {d.issuer for d in documents}
    issuers = {u.address: u.full_name for u in db.query(User).filter(User.address.in_(issuer_addresses)).all()} if issuer_addresses else {}
    return [
        {
            "id": d.id,
            "token_id": d.token_id,
            "issuer": issuers.get(d.issuer, d.issuer),
            "issuer_address": d.issuer,
            "owner": d.owner,
            "doc_type": d.doc_type,
            "doc_key": d.doc_key,
            "ipfs_cid": d.ipfs_cid,
            "is_active": d.is_active,
            "is_transferable": d.is_transferable,
            "attributes": d.attributes,
            "created_at": d.created_at,
        } for d in documents
    ]

# ============================================================
# Workflows
# ============================================================
@app.on_event("startup")
async def startup_event():
    app.state.workflow_engine = WorkflowEngine(
        db=SessionLocal(),
        blockchain_client=blockchain_client,
        ipfs_client=ipfs_client,
        event_bus=event_bus
    )

@app.post("/workflows/create")
def create_workflow(
    request: WorkflowCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflow = engine.create_workflow(
        workflow_type=request.workflow_type,
        initiator_id=current_user["id"],
        target_user_id=request.target_user_id,
        document_token_id=request.document_token_id,
        document_cid=request.document_cid,
        workflow_data=request.workflow_data
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}

@app.post("/workflows/{workflow_id}/start")
def start_workflow(
    workflow_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflow = engine.start_workflow(workflow_id, current_user["id"])
    return {"workflow_id": workflow.id, "status": workflow.status.value}

@app.post("/workflows/{workflow_id}/request-verification")
def request_verification(
    workflow_id: int,
    request: VerificationRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflow = engine.request_verification(
        workflow_id=workflow_id,
        actor_id=current_user["id"],
        verifier_id=request.verifier_id,
        verification_data=request.verification_data
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}

@app.post("/workflows/{workflow_id}/submit-verification")
def submit_verification(
    workflow_id: int,
    request: VerificationSubmit,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflow = engine.submit_verification(
        workflow_id=workflow_id,
        actor_id=current_user["id"],
        is_valid=request.is_valid,
        verification_notes=request.notes
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}

@app.post("/workflows/{workflow_id}/request-notary")
def request_notary_validation(
    workflow_id: int,
    request: NotaryRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflow = engine.request_notary_validation(
        workflow_id=workflow_id,
        actor_id=current_user["id"],
        notary_id=request.notary_id
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}

@app.post("/workflows/{workflow_id}/validate-by-notary")
def validate_by_notary(
    workflow_id: int,
    request: NotaryValidation,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflow = engine.validate_by_notary(
        workflow_id=workflow_id,
        actor_id=current_user["id"],
        is_valid=request.is_valid,
        validation_notes=request.notes,
        transaction_hash=request.transaction_hash
    )
    response = {"workflow_id": workflow.id, "status": workflow.status.value}
    transfer_result = (workflow.workflow_data or {}).get("transfer_result")
    if transfer_result:
        response.update(transfer_result)
    return response

@app.post("/workflows/{workflow_id}/cancel")
def cancel_workflow(
    workflow_id: int,
    request: CancelRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflow = engine.cancel_workflow(
        workflow_id=workflow_id,
        actor_id=current_user["id"],
        reason=request.reason
    )
    return {"workflow_id": workflow.id, "status": workflow.status.value}

@app.get("/workflows/{workflow_id}/status")
def get_workflow_status(
    workflow_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflow = engine.get_workflow(workflow_id)
    return {
        "workflow_id": workflow.id,
        "status": workflow.status.value,
        "workflow_type": workflow.workflow_type.value,
        "initiator_id": workflow.initiator_id,
        "target_user_id": workflow.target_user_id,
        "notary_id": workflow.notary_id,
        "document_token_id": workflow.document_token_id,
        "workflow_data": workflow.workflow_data,
        "created_at": workflow.created_at,
        "updated_at": workflow.updated_at,
        "completed_at": workflow.completed_at,
        "steps": [
            {
                "step_name": step.step_name,
                "action": step.action,
                "status": step.status,
                "created_at": step.created_at
            } for step in workflow.steps
        ]
    }

@app.get("/workflows/my")
def get_my_workflows(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    engine = WorkflowEngine(db, blockchain_client, ipfs_client, event_bus)
    workflows = engine.get_user_workflows(current_user["id"], status)
    return [
        {
            "id": w.id,
            "type": w.workflow_type.value,
            "status": w.status.value,
            "initiator_id": w.initiator_id,
            "target_user_id": w.target_user_id,
            "notary_id": w.notary_id,
            "document_token_id": w.document_token_id,
            "workflow_data": w.workflow_data,
            "created_at": w.created_at,
            "updated_at": w.updated_at
        } for w in workflows
    ]

# ============================================================
# Users (annuaire pour choisir un destinataire/vérificateur)
# ============================================================
@app.get("/users")
def list_users(
    role: Optional[str] = None,
    mine: bool = False,
    q: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.is_active == True)
    if role:
        query = query.filter(User.role == role)
    if q:
        # Recherche libre (nom/prénom ou n° CNI) — utilisée par le sélecteur de destinataire
        # quand la cible peut être un citoyen parmi beaucoup d'autres (ex. titre foncier),
        # là où un simple menu déroulant ne suffit plus.
        like = f"%{q}%"
        query = query.filter(or_(User.full_name.ilike(like), User.national_id_number.ilike(like)))
    if mine:
        # Restreint aux comptes créés par l'appelant (étudiants d'une université, employés
        # d'une entreprise) OU rattachés à lui après coup (personne déjà identifiée par un
        # autre acteur, ex. l'Admin, puis rattachée à cet établissement — cf. UserAffiliation)
        # — évite qu'une entreprise puisse émettre une attestation à n'importe quel
        # utilisateur de la plateforme au lieu de ses propres employés/rattachés.
        affiliated_ids = db.query(UserAffiliation.user_id).filter(
            UserAffiliation.institution_id == current_user["id"]
        )
        query = query.filter(
            or_(User.created_by == current_user["id"], User.id.in_(affiliated_ids))
        )
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "did": u.did,
            "address": u.address,
            "national_id_number": u.national_id_number,
            "created_at": u.created_at,
        } for u in query.order_by(User.full_name).all()
    ]
