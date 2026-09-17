"""Service core (ex-monolithe) — ce qui n'a pas été réparti dans les 6 modules du
découpage : statistiques, notifications, bus WebSocket temps réel, annuaire des acteurs
(/users). Expose aussi /internal/notify et /internal/push, appelés en HTTP interne par les
modules documents/exchange pour déclencher une notification — ils n'ont plus accès en
process au même bus WebSocket, hébergé ici (réseau Docker interne uniquement, non routé par
Kong)."""
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
from pydantic import BaseModel
from trustwedge_auth import get_current_user

load_dotenv()

from .database import engine, get_db, run_light_migrations
from .models import Base, User, UserAffiliation
from .shared import event_bus
from .services.notification_service import notify
from .routers import (
    kyc as kyc_router,
    notifications as notifications_router,
    stats as stats_router,
    verification as verification_router,
)

Base.metadata.create_all(bind=engine)
run_light_migrations()

app = FastAPI(title="TrustWedge Core", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(kyc_router.router)
app.include_router(notifications_router.router)
app.include_router(stats_router.router)
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
# Notifications internes (appelées par documents/exchange, réseau Docker uniquement)
# ============================================================
class InternalNotifyRequest(BaseModel):
    user_id: int
    type: str
    message: str
    workflow_id: Optional[int] = None
    token_id: Optional[int] = None


class InternalPushRequest(BaseModel):
    user_id: int
    payload: dict


@app.post("/internal/notify")
async def internal_notify(request: InternalNotifyRequest, db: Session = Depends(get_db)):
    """Persiste une notification et la pousse en temps réel — équivalent HTTP de l'ancien
    appel en process à services.notification_service.notify()."""
    await notify(
        db, event_bus, request.user_id,
        type=request.type, message=request.message,
        workflow_id=request.workflow_id, token_id=request.token_id,
    )
    return {"status": "ok"}


@app.post("/internal/push")
async def internal_push(request: InternalPushRequest):
    """Pousse un message éphémère (non persisté) — équivalent HTTP de l'ancien
    event_bus.send_to_user() appelé directement par workflow_engine.py."""
    await event_bus.send_to_user(request.user_id, request.payload)
    return {"status": "ok"}

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
        # Recherche libre par nom — utilisée par le sélecteur de destinataire quand la cible
        # peut être un citoyen parmi beaucoup d'autres (ex. titre foncier), là où un simple
        # menu déroulant ne suffit plus. Le n° de CNI n'est plus stocké en clair (seulement
        # son hash), donc plus consultable par recherche partielle ici.
        like = f"%{q}%"
        query = query.filter(User.full_name.ilike(like))
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
            "created_at": u.created_at,
        } for u in query.order_by(User.full_name).all()
    ]
