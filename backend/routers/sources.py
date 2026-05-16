"""信息源管理 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.models import Source
from schemas import SourceCreate, SourceUpdate, SourceResponse

router = APIRouter(prefix="/api/sources", tags=["信息源"])


@router.get("/", response_model=list[SourceResponse])
def list_sources(db: Session = Depends(get_db)):
    return db.query(Source).order_by(Source.created_at.desc()).all()


@router.post("/", response_model=SourceResponse)
def create_source(data: SourceCreate, db: Session = Depends(get_db)):
    source = Source(**data.model_dump())
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.get("/{source_id}", response_model=SourceResponse)
def get_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "信息源不存在")
    return source


@router.put("/{source_id}", response_model=SourceResponse)
def update_source(source_id: int, data: SourceUpdate, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "信息源不存在")

    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    for key, value in update_data.items():
        setattr(source, key, value)

    db.commit()
    db.refresh(source)
    return source


@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "信息源不存在")
    db.delete(source)
    db.commit()
    return {"message": "已删除"}
