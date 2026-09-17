import hashlib
import os
import requests


class IPFSClient:
    def __init__(self):
        self.api_url = os.getenv("IPFS_API_URL", "http://ipfs:5001")

    def upload_file(self, content: bytes, filename: str) -> str:
        response = requests.post(
            f"{self.api_url}/api/v0/add",
            files={"file": (filename, content)},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["Hash"]

    def get_file(self, cid: str) -> bytes:
        response = requests.post(
            f"{self.api_url}/api/v0/cat",
            params={"arg": cid},
            timeout=30,
        )
        response.raise_for_status()
        return response.content

    def upload_and_pin(self, content: bytes, filename: str) -> str:
        """Upload un fichier sur IPFS et le pin explicitement."""
        cid = self.upload_file(content, filename)
        response = requests.post(
            f"{self.api_url}/api/v0/pin/add",
            params={"arg": cid},
            timeout=30,
        )
        response.raise_for_status()
        return cid

    def compute_hash(self, content: bytes) -> str:
        """Hash SHA-256 d'un contenu — permet de détecter un fichier inchangé sans
        repasser par un upload IPFS (le CID en dérive de toute façon, mais plus lentement)."""
        return hashlib.sha256(content).hexdigest()

    def compute_cid(self, content: bytes, filename: str = "file") -> str:
        """Calcule le CID IPFS d'un contenu sans le stocker ni le pinner (`only-hash`) —
        utile pour comparer un fichier fourni par un utilisateur au CID enregistré
        on-chain, sans polluer le nœud avec du contenu non vérifié."""
        response = requests.post(
            f"{self.api_url}/api/v0/add",
            params={"only-hash": "true"},
            files={"file": (filename, content)},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["Hash"]

    def get_file_size(self, cid: str) -> int:
        """Récupère la taille d'un fichier sur IPFS."""
        response = requests.post(
            f"{self.api_url}/api/v0/object/stat",
            params={"arg": cid},
            timeout=30,
        )
        response.raise_for_status()
        return response.json().get("CumulativeSize", 0)
