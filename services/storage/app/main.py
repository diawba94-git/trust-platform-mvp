"""Module storage — wrapper interne autour d'IPFS (ipfs_utils.py, inchangé). Jamais exposé
publiquement par Kong : accessible uniquement depuis le réseau Docker interne, par les
modules documents/verify/exchange qui remplacent leurs anciens appels directs à
ipfs_utils.py par un appel HTTP interne ici. Pas d'authentification applicative sur ces
routes : la frontière de confiance est le réseau Docker privé, pas un JWT utilisateur (ces
appels sont de service à service, jamais initiés directement par un client final)."""
from fastapi import FastAPI, File, HTTPException, Response, UploadFile

from .ipfs_utils import IPFSClient

app = FastAPI(title="TrustWedge Storage (internal)", version="1.0.0")

ipfs_client = IPFSClient()


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/internal/storage/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()
    cid = ipfs_client.upload_file(content, file.filename or "file")
    return {"cid": cid}


@app.post("/internal/storage/upload-and-pin")
async def upload_and_pin(file: UploadFile = File(...)):
    content = await file.read()
    cid = ipfs_client.upload_and_pin(content, file.filename or "file")
    return {"cid": cid}


@app.post("/internal/storage/hash")
async def hash_only(file: UploadFile = File(...)):
    """CID calculé sans stockage ni pin (`only-hash`) — comparer un fichier fourni par un
    utilisateur au CID enregistré on-chain sans polluer le nœud avec du contenu non vérifié."""
    content = await file.read()
    cid = ipfs_client.compute_cid(content, file.filename or "file")
    return {"cid": cid}


@app.get("/internal/storage/file/{cid}")
def get_file(cid: str):
    try:
        content = ipfs_client.get_file(cid)
    except Exception:
        raise HTTPException(status_code=404, detail="Fichier introuvable sur IPFS")
    return Response(content=content, media_type="application/pdf")
