from trustwedge_auth.pii import hash_national_id


def test_same_value_same_hash():
    assert hash_national_id("1234567890123") == hash_national_id("1234567890123")


def test_normalizes_whitespace_and_case():
    assert hash_national_id("  ab1234  ") == hash_national_id("AB1234")


def test_different_values_different_hash():
    assert hash_national_id("1234567890123") != hash_national_id("1234567890124")


def test_produces_hex_sha256():
    digest = hash_national_id("1234567890123")
    assert len(digest) == 64
    int(digest, 16)  # lève ValueError si ce n'est pas de l'hexadécimal
