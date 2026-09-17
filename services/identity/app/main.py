"""Module identity — admin.py + actors.py + did.py du monolithe d'origine. Génération de
DID, gestion des acteurs (création par un admin ou par un établissement), régénération de
clé. Valide le JWT émis par le module auth via la bibliothèque partagée trustwedge_auth —
ne gère plus le login lui-même."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import admin, actors, did, internal

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustWedge Identity", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(PermissionError)
async def permission_error_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "healthy"}


app.include_router(admin.router, prefix="/api")
app.include_router(actors.router, prefix="/api")
app.include_router(did.router, prefix="/api")
app.include_router(internal.router)
