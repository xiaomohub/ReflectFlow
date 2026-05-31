"""信息源管理 API"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from auth import require_admin
from models.database import get_db
from models.models import Source, Article
from schemas import SourceCreate, SourceUpdate, SourceResponse, SourceImportItem, ArticleResponse

router = APIRouter(prefix="/api/sources", tags=["信息源"], dependencies=[Depends(require_admin)])


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


@router.get("/{source_id}/articles", response_model=list[ArticleResponse])
def get_source_articles(
    source_id: int,
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
):
    """获取某个信息源的文章（供内嵌展开使用）"""
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "信息源不存在")
    articles = (
        db.query(Article)
        .filter(Article.source_id == source_id)
        .order_by(desc(Article.created_at))
        .limit(limit)
        .all()
    )
    return articles


@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(404, "信息源不存在")
    db.delete(source)
    db.commit()
    return {"message": "已删除"}


# ===== 批量操作 =====

@router.post("/batch-import")
def batch_import_sources(data: list[SourceImportItem], db: Session = Depends(get_db)):
    """批量导入信息源（JSON 数组格式）"""
    imported = 0
    errors: list[dict] = []
    for i, item in enumerate(data):
        try:
            source = Source(
                name=item.name,
                source_type=item.source_type,
                url=item.url,
                description=item.description or "",
                tags=item.tags or [],
                enabled=item.enabled,
                skip_filter=item.skip_filter,
                config=item.config or {},
            )
            db.add(source)
            db.flush()
            imported += 1
        except Exception as e:
            errors.append({"index": i, "name": item.name, "error": str(e)})
    db.commit()
    return {
        "message": f"成功导入 {imported} 个信息源" + (f"，{len(errors)} 个失败" if errors else ""),
        "imported": imported,
        "errors": errors,
    }


@router.post("/batch-delete")
def batch_delete_sources(source_ids: list[int], db: Session = Depends(get_db)):
    """批量删除信息源"""
    deleted = db.query(Source).filter(Source.id.in_(source_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"已删除 {deleted} 个信息源", "deleted": deleted}
