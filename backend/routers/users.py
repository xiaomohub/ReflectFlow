"""人员与权限管理 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user, require_admin
from models.database import get_db
from models.models import AppUser
from schemas import AppUserCreate, AppUserResponse, AppUserUpdate

router = APIRouter(prefix="/api/users", tags=["权限管理"])


def _validate_role(role: str) -> str:
    role_value = (role or "").strip().lower()
    if role_value not in {"admin", "normal"}:
        raise HTTPException(400, "角色仅支持 admin 或 normal")
    return role_value


@router.get("/me", response_model=AppUserResponse)
def get_me(current_user: AppUser = Depends(get_current_user)):
    return current_user


@router.get("/active", response_model=list[AppUserResponse])
def list_active_users(
    _: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用于前端人员切换下拉，返回所有启用中的人员。"""
    return db.query(AppUser).filter(AppUser.is_active == True).order_by(AppUser.id.asc()).all()


@router.get("/", response_model=list[AppUserResponse])
def list_users(_: AppUser = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(AppUser).order_by(AppUser.id.asc()).all()


@router.post("/", response_model=AppUserResponse)
def create_user(data: AppUserCreate, _: AppUser = Depends(require_admin), db: Session = Depends(get_db)):
    username = data.username.strip()
    display_name = data.display_name.strip()
    if not username or not display_name:
        raise HTTPException(400, "用户名和显示名称不能为空")

    exists = db.query(AppUser).filter(AppUser.username == username).first()
    if exists:
        raise HTTPException(409, "用户名已存在")

    user = AppUser(
        username=username,
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
