from trustwedge_auth.security import get_password_hash, verify_password


def test_verify_succeeds_with_correct_password():
    hashed = get_password_hash("correct-horse-battery-staple")
    assert verify_password("correct-horse-battery-staple", hashed) is True


def test_verify_fails_with_wrong_password():
    hashed = get_password_hash("correct-horse-battery-staple")
    assert verify_password("wrong-password", hashed) is False


def test_hash_is_salted_and_not_reversible_to_plaintext():
    h1 = get_password_hash("same-password")
    h2 = get_password_hash("same-password")
    assert h1 != h2  # sels différents à chaque hash
    assert "same-password" not in h1
    assert verify_password("same-password", h1) is True
    assert verify_password("same-password", h2) is True
