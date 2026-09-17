"""Module auth — unique propriétaire du hachage de mot de passe et de l'émission du JWT.
Toute la logique de vérification (hash bcrypt, encodage/décodage JWT) vient de la
bibliothèque partagée trustwedge_auth (packages/backend-shared) — les 5 autres modules
importent get_current_user/get_current_admin de cette même bibliothèque pour valider le
même token, sans jamais réimplémenter leur propre vérification."""
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from trustwedge_auth import create_access_token, get_password_hash, verify_password

from .database import Base, engine, get_db
from .models import User
from .schemas import LoginRequest, TokenResponse, UserCreate, UserOut

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustWedge Auth", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/auth/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = User(
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        address=user.address,
        did=f"did:ethr:{user.address}",
        hashed_password=get_password_hash(user.password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.post("/api/auth/login", response_model=TokenResponse)
def login(form_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # hashed_password absent : compte créé avant l'introduction de cette vérification (ou
    # provisionné par un admin sans mot de passe initial) — refusé plutôt que laissé passer,
    # jamais de mot de passe généré à sa place. Seul un admin peut en définir un explicitement
    # (POST /admin/actors/{id}/set-password, module identity).
    if not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=access_token, token_type="bearer", user=user)
