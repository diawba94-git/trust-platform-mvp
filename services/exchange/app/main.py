"""Module exchange — transfers.py + shares.py + disclosure.py. Appelle documents en HTTP
interne pour lire/mettre à jour le statut d'un document avant d'autoriser un
transfert/partage, plutôt que d'accéder directement à la table Document."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import Base, engine
from .routers import transfers, shares, disclosure

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustWedge Exchange", version="1.0.0")
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


app.include_router(transfers.router, prefix="/api")
app.include_router(shares.router, prefix="/api")
app.include_router(disclosure.router, prefix="/api")
