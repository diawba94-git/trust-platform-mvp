import os
import requests

STORAGE_URL = os.getenv("STORAGE_SERVICE_URL", "http://storage:8000")


def upload_file(content: bytes, filename: str) -> str:
    response = requests.post(
        f"{STORAGE_URL}/internal/storage/upload",
        files={"file": (filename, content)},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["cid"]


def upload_and_pin(content: bytes, filename: str) -> str:
    response = requests.post(
        f"{STORAGE_URL}/internal/storage/upload-and-pin",
        files={"file": (filename, content)},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["cid"]


def hash_only(content: bytes, filename: str = "file") -> str:
    response = requests.post(
        f"{STORAGE_URL}/internal/storage/hash",
        files={"file": (filename, content)},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["cid"]


def get_file(cid: str) -> bytes:
    response = requests.get(f"{STORAGE_URL}/internal/storage/file/{cid}", timeout=30)
    response.raise_for_status()
    return response.content
