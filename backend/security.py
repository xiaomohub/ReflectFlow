"""本地账号密码安全工具"""

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

DEFAULT_AUTH_SECRET = "reflectflow-dev-secret-change-me"
TOKEN_EXPIRE_SECONDS = int(os.getenv("AUTH_TOKEN_EXPIRE_SECONDS", "86400"))
PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "10"))


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    return hash_password(password) == password_hash


def validate_password_strength(password: str) -> tuple[bool, str]:
    value = (password or "").strip()
    if len(value) < PASSWORD_MIN_LENGTH:
        return False, f"密码至少需要 {PASSWORD_MIN_LENGTH} 位"
    if value.lower() == value:
        return False, "密码必须包含至少 1 个大写字母"
    if value.upper() == value:
        return False, "密码必须包含至少 1 个小写字母"
    if not any(ch.isdigit() for ch in value):
        return False, "密码必须包含至少 1 个数字"
    if not any(not ch.isalnum() for ch in value):
        return False, "密码必须包含至少 1 个特殊字符"
    if any(ch.isspace() for ch in value):
        return False, "密码不能包含空白字符"
    return True, ""


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}")


def _get_auth_secret() -> bytes:
    secret = os.getenv("AUTH_TOKEN_SECRET", "").strip() or DEFAULT_AUTH_SECRET
    return secret.encode("utf-8")


def create_access_token(user_id: int, role: str) -> str:
    payload = {
        "uid": user_id,
        "role": role,
        "exp": int(time.time()) + TOKEN_EXPIRE_SECONDS,
    }
    payload_bytes = json.dumps(payload, ensure_ascii=True, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(_get_auth_secret(), payload_bytes, hashlib.sha256).digest()
    return f"{_b64url_encode(payload_bytes)}.{_b64url_encode(signature)}"


def verify_access_token(token: str) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    payload_part, signature_part = token.split(".", 1)
    try:
        payload_bytes = _b64url_decode(payload_part)
        expected_signature = hmac.new(_get_auth_secret(), payload_bytes, hashlib.sha256).digest()
        signature = _b64url_decode(signature_part)
    except Exception:
        return None

    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        return None

    exp = payload.get("exp")
    uid = payload.get("uid")
    if not isinstance(exp, int) or not isinstance(uid, int):
        return None
    if exp <= int(time.time()):
        return None
    return payload
