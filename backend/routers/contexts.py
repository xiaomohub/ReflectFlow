"""用户领域上下文管理 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.models import UserContext
from schemas import UserContextCreate, UserContextUpdate, UserContextResponse

router = APIRouter(prefix="/api/contexts", tags=["用户领域"])


@router.get("/", response_model=list[UserContextResponse])
def list_contexts(db: Session = Depends(get_db)):
    return db.query(UserContext).order_by(UserContext.priority.desc()).all()


@router.post("/", response_model=UserContextResponse)
def create_context(data: UserContextCreate, db: Session = Depends(get_db)):
    ctx = UserContext(**data.model_dump())
    db.add(ctx)
    db.commit()
    db.refresh(ctx)
    return ctx


@router.put("/{ctx_id}", response_model=UserContextResponse)
def update_context(ctx_id: int, data: UserContextUpdate, db: Session = Depends(get_db)):
    ctx = db.query(UserContext).filter(UserContext.id == ctx_id).first()
    if not ctx:
        raise HTTPException(404, "领域不存在")

    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    for key, value in update_data.items():
        setattr(ctx, key, value)

    db.commit()
    db.refresh(ctx)
    return ctx


@router.delete("/{ctx_id}")
def delete_context(ctx_id: int, db: Session = Depends(get_db)):
    ctx = db.query(UserContext).filter(UserContext.id == ctx_id).first()
    if not ctx:
        raise HTTPException(404, "领域不存在")
    db.delete(ctx)
    db.commit()
    return {"message": "已删除"}
