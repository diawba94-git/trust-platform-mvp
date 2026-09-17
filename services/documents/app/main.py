"""Module documents (écriture) — endpoints d'émission de workflow_engine.py + partie
écriture de documents.py. Appelle identity en HTTP interne pour résoudre un nom depuis une
adresse (jamais d'accès direct à la table User), et storage en HTTP interne pour IPFS."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import Base, engine
from .routers import documents, workflows, internal

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustWedge Documents", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(PermissionError)
async def permission_error_handler(request, exc):
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "healthy"}


app.include_router(documents.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")
app.include_router(internal.router)
