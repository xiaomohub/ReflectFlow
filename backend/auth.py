"""权限与当前人员依赖"""

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.models import AppUser


def get_current_user(
    db: Session = Depends(get_db),
    x_user_id: int | None = Header(default=None, alias="X-User-Id"),
) -> AppUser:
    """通过请求头 X-User-Id 获取当前人员，缺省时回退到默认管理员。"""
    user = None
    if x_user_id is not None:
        user = db.query(AppUser).filter(AppUser.id == x_user_id, AppUser.is_active == True).first()
    if user:
        return user

    default_admin = db.query(AppUser).filter(AppUser.username == "admin", AppUser.is_active == True).first()
    if default_admin:
        return default_admin

    fallback = db.query(AppUser).filter(AppUser.is_active == True).order_by(AppUser.id.asc()).first()
    if fallback:
        return fallback

    raise HTTPException(503, "系统尚未初始化任何可用人员")


def require_admin(current_user: AppUser = Depends(get_current_user)) -> AppUser:
    """仅允许管理员访问。"""
    if current_user.role != "admin":
        raise HTTPException(403, "仅管理员可执行该操作")
    return current_user
