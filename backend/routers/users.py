"""人员与权限管理 API"""

import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from models.database import get_db
from models.models import AppUser
from schemas import (
    AppUserChangePasswordRequest,
    AppUserCreate,
    AppUserLoginRequest,
    AppUserLoginResponse,
    AppUserResponse,
    AppUserUpdate,
)
from security import (
    TOKEN_EXPIRE_SECONDS,
    create_access_token,
    hash_password,
    validate_password_strength,
    verify_password,
)

router = APIRouter(prefix="/api/users", tags=["权限管理"])

LOGIN_WINDOW_SECONDS = 10 * 60
LOGIN_MAX_ATTEMPTS_PER_USER_IP = 5
LOGIN_LOCK_SECONDS_PER_USER_IP = 15 * 60
LOGIN_MAX_ATTEMPTS_PER_IP = 20

_LOGIN_FAILS_USER_IP: dict[str, deque[float]] = defaultdict(deque)
_LOGIN_FAILS_IP: dict[str, deque[float]] = defaultdict(deque)
_LOGIN_LOCKED_UNTIL_USER_IP: dict[str, float] = {}


def _validate_role(role: str) -> str:
    role_value = (role or "").strip().lower()
    if role_value not in {"admin", "normal"}:
        raise HTTPException(400, "角色仅支持 admin 或 normal")
    return role_value


def _clean_old_attempts(queue: deque[float], now_ts: float) -> None:
    cutoff = now_ts - LOGIN_WINDOW_SECONDS
    while queue and queue[0] < cutoff:
        queue.popleft()


def _check_login_rate_limit(ip: str, username: str) -> None:
    now_ts = time.time()
    user_ip_key = f"{ip}:{username.lower()}"
    locked_until = _LOGIN_LOCKED_UNTIL_USER_IP.get(user_ip_key)
    if locked_until and locked_until > now_ts:
        wait_seconds = int(locked_until - now_ts)
        raise HTTPException(429, f"登录失败次数过多，请 {wait_seconds} 秒后重试")

    ip_queue = _LOGIN_FAILS_IP[ip]
    _clean_old_attempts(ip_queue, now_ts)
    if len(ip_queue) >= LOGIN_MAX_ATTEMPTS_PER_IP:
        raise HTTPException(429, "请求过于频繁，请稍后再试")

    user_ip_queue = _LOGIN_FAILS_USER_IP[user_ip_key]
    _clean_old_attempts(user_ip_queue, now_ts)
    if len(user_ip_queue) >= LOGIN_MAX_ATTEMPTS_PER_USER_IP:
        _LOGIN_LOCKED_UNTIL_USER_IP[user_ip_key] = now_ts + LOGIN_LOCK_SECONDS_PER_USER_IP
        raise HTTPException(429, "登录失败次数过多，请稍后再试")


def _record_login_failure(ip: str, username: str) -> None:
    now_ts = time.time()
    user_ip_key = f"{ip}:{username.lower()}"

    ip_queue = _LOGIN_FAILS_IP[ip]
    ip_queue.append(now_ts)
    _clean_old_attempts(ip_queue, now_ts)

    user_ip_queue = _LOGIN_FAILS_USER_IP[user_ip_key]
    user_ip_queue.append(now_ts)
    _clean_old_attempts(user_ip_queue, now_ts)
    if len(user_ip_queue) >= LOGIN_MAX_ATTEMPTS_PER_USER_IP:
        _LOGIN_LOCKED_UNTIL_USER_IP[user_ip_key] = now_ts + LOGIN_LOCK_SECONDS_PER_USER_IP


def _clear_login_failure(ip: str, username: str) -> None:
    user_ip_key = f"{ip}:{username.lower()}"
    _LOGIN_FAILS_USER_IP.pop(user_ip_key, None)
    _LOGIN_LOCKED_UNTIL_USER_IP.pop(user_ip_key, None)


@router.get("/me", response_model=AppUserResponse)
def get_me(current_user: AppUser = Depends(get_current_user)):
    return current_user


@router.post("/refresh", response_model=AppUserLoginResponse)
def refresh_login(current_user: AppUser = Depends(get_current_user)):
    token = create_access_token(current_user.id, current_user.role)
    return {
        "token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_EXPIRE_SECONDS,
        "user": current_user,
    }


@router.get("/active", response_model=list[AppUserResponse])
def list_active_users(
    _: AppUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """返回所有启用中的人员（仅管理员）。"""
    return db.query(AppUser).filter(AppUser.is_active == True).order_by(AppUser.id.asc()).all()


@router.post("/login", response_model=AppUserLoginResponse)
def login(data: AppUserLoginRequest, request: Request, db: Session = Depends(get_db)):
    username = data.username.strip()
    password = data.password.strip()
    if not username or not password:
        raise HTTPException(400, "账号和密码不能为空")

    client_ip = request.client.host if request.client else "unknown"
    _check_login_rate_limit(client_ip, username)

    user = db.query(AppUser).filter(
        AppUser.username == username,
        AppUser.is_active == True,
    ).first()
    if not user or not verify_password(password, user.password_hash):
        _record_login_failure(client_ip, username)
        raise HTTPException(401, "账号或密码错误")

    _clear_login_failure(client_ip, username)
    token = create_access_token(user.id, user.role)
    return {
        "token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_EXPIRE_SECONDS,
        "user": user,
    }


@router.get("/", response_model=list[AppUserResponse])
def list_users(_: AppUser = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(AppUser).order_by(AppUser.id.asc()).all()


@router.post("/", response_model=AppUserResponse)
def create_user(data: AppUserCreate, _: AppUser = Depends(require_admin), db: Session = Depends(get_db)):
    username = data.username.strip()
    password = data.password.strip()
    display_name = data.display_name.strip()
    if not username or not display_name or not password:
        raise HTTPException(400, "用户名、密码和显示名称不能为空")

    exists = db.query(AppUser).filter(AppUser.username == username).first()
    if exists:
        raise HTTPException(409, "用户名已存在")
    password_ok, password_error = validate_password_strength(password)
    if not password_ok:
        raise HTTPException(400, password_error)

    user = AppUser(
        username=username,
        password_hash=hash_password(password),
        display_name=display_name,
        role=_validate_role(data.role),
        is_active=data.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=AppUserResponse)
def update_user(
    user_id: int,
    data: AppUserUpdate,
    current_user: AppUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(404, "人员不存在")

    payload = data.model_dump(exclude_unset=True)
    if "role" in payload and payload["role"] is not None:
        payload["role"] = _validate_role(payload["role"])
    if "password" in payload and payload["password"] is not None:
        password = str(payload["password"]).strip()
        if not password:
            raise HTTPException(400, "密码不能为空")
        password_ok, password_error = validate_password_strength(password)
        if not password_ok:
            raise HTTPException(400, password_error)
        payload["password_hash"] = hash_password(password)
        del payload["password"]

    if current_user.id == user.id and payload.get("is_active") is False:
        raise HTTPException(400, "不能停用当前登录人员")

    # 保护：最后一个管理员不能被降级/停用
    if (payload.get("role") == "normal" or payload.get("is_active") is False) and user.role == "admin":
        admin_count = db.query(AppUser).filter(AppUser.role == "admin", AppUser.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(400, "系统至少需要保留一个启用中的管理员")

    for key, value in payload.items():
        if value is not None:
            setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return user


@router.post("/change-password")
def change_password(
    data: AppUserChangePasswordRequest,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    old_password = data.old_password.strip()
    new_password = data.new_password.strip()
    if not old_password or not new_password:
        raise HTTPException(400, "原密码和新密码不能为空")
    if not verify_password(old_password, current_user.password_hash):
        raise HTTPException(401, "原密码错误")
    if old_password == new_password:
        raise HTTPException(400, "新密码不能与原密码相同")

    password_ok, password_error = validate_password_strength(new_password)
    if not password_ok:
        raise HTTPException(400, password_error)

    user = db.query(AppUser).filter(AppUser.id == current_user.id).first()
    if not user:
        raise HTTPException(404, "人员不存在")

    user.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "密码修改成功，请重新登录"}
