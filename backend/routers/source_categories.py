"""信息源分类管理 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.models import SourceCategory, Source
from schemas import SourceCategoryCreate, SourceCategoryUpdate, SourceCategoryResponse

router = APIRouter(prefix="/api/source-categories", tags=["信息源分类"])


@router.get("/", response_model=list[SourceCategoryResponse])
def list_source_categories(db: Session = Depends(get_db)):
    return db.query(SourceCategory).order_by(SourceCategory.sort_order).all()


@router.post("/", response_model=SourceCategoryResponse)
def create_source_category(data: SourceCategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(SourceCategory).filter(
        SourceCategory.name == data.name,
        SourceCategory.parent_id == data.parent_id,
    ).first()
    if existing:
        raise HTTPException(409, f"分类「{data.name}」已存在")
    cat = SourceCategory(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=SourceCategoryResponse)
def update_source_category(category_id: int, data: SourceCategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(SourceCategory).filter(SourceCategory.id == category_id).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    for key, value in update_data.items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}")
def delete_source_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(SourceCategory).filter(SourceCategory.id == category_id).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    db.query(Source).filter(Source.category_id == category_id).update({Source.category_id: None})
    db.delete(cat)
    db.commit()
    return {"message": "已删除"}
