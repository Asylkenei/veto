"""Password hashing (PBKDF2-SHA256, stdlib) and opaque session tokens."""
import base64
import hashlib
import hmac
import secrets

ITERATIONS = 310_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        ITERATIONS,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, iterations, salt_b64, digest_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), base64.b64decode(salt_b64), int(iterations)
        )
        return hmac.compare_digest(digest, base64.b64decode(digest_b64))
    except (ValueError, TypeError):
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """Only hashes of session tokens are stored, so a DB leak does not leak sessions."""
    return hashlib.sha256(token.encode()).hexdigest()


def password_problems(password: str) -> list[str]:
    problems = []
    if len(password) < 8:
        problems.append("не короче 8 символов")
    if not any(c.isdigit() for c in password):
        problems.append("хотя бы одна цифра")
    if not any(c.isalpha() for c in password):
        problems.append("хотя бы одна буква")
    return problems
