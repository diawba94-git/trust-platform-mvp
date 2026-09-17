"""Module verify (lecture seule) — partie lecture de documents.py (verify-file,
verify-file-auto, versions, owner-at) + GET /documents/verify/{token_id}. Ne détient AUCUNE
clé de signature — lecture blockchain uniquement (web3.py en mode call())."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import verify

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustWedge Verify", version="1.0.0")
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


app.include_router(verify.router, prefix="/api")
