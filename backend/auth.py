"""权限与当前人员依赖"""

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from models.database import get_db
from models.models import AppUser
from security import verify_access_token


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> AppUser:
    """通过 Bearer Token 获取当前人员。"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或登录已失效",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:].strip()
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录凭证无效或已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = int(payload["uid"])
    user = db.query(AppUser).filter(AppUser.id == user_id, AppUser.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="当前账号不可用")
    return user


def require_admin(current_user: AppUser = Depends(get_current_user)) -> AppUser:
    """仅允许管理员访问。"""
    if current_user.role != "admin":
        raise HTTPException(403, "仅管理员可执行该操作")
    return current_user
