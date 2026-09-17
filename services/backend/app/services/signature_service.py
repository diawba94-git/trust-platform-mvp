from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys import keys


def sign_hash(private_key: str, message_hash: bytes) -> str:
    """Signe un hash (personal_sign / EIP-191) avec une clé privée."""
    account = Account.from_key(private_key)
    signable = encode_defunct(primitive=message_hash)
    signed = account.sign_message(signable)
    return signed.signature.hex()


def verify_hash_signature(message_hash: bytes, signature: str, expected_address: str) -> bool:
    """Vérifie qu'une signature (personal_sign / EIP-191) correspond bien à l'adresse attendue."""
    signable = encode_defunct(primitive=message_hash)
    recovered = Account.recover_message(signable, signature=signature)
    return recovered.lower() == expected_address.lower()


def sign_raw_hash(private_key: str, message_hash: bytes) -> str:
    """Signe un hash 32 octets en ECDSA brut (SANS préfixe EIP-191) — c'est ce que le
    contrat DocumentRegistry vérifie via ECDSA.recover() pour la vente à triple signature."""
    signed = Account._sign_hash(message_hash, private_key)
    return signed.signature.hex()


def verify_raw_hash_signature(message_hash: bytes, signature: str, expected_address: str) -> bool:
    """Vérifie une signature ECDSA brute (sans préfixe EIP-191)."""
    sig_bytes = bytes.fromhex(signature[2:] if signature.startswith("0x") else signature)
    r = int.from_bytes(sig_bytes[0:32], "big")
    s = int.from_bytes(sig_bytes[32:64], "big")
    v = sig_bytes[64]
    signature_obj = keys.Signature(vrs=(v - 27 if v >= 27 else v, r, s))
    recovered = signature_obj.recover_public_key_from_msg_hash(message_hash).to_checksum_address()
    return recovered.lower() == expected_address.lower()
