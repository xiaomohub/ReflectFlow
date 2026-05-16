"""文章管理 & AI 过滤 API"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models.database import get_db
from models.models import Article
from schemas import ArticleUpdate, ArticleResponse, ArticleFilterRequest
from services.ai_filter import AIFilterService
from services.source_fetcher import SourceFetcher

router = APIRouter(prefix="/api/articles", tags=["文章"])


@router.get("/", response_model=list[ArticleResponse])
def list_articles(
    status: str = Query("new", description="筛选状态: new/reviewed/archived/actioned/all"),
    sort_by: str = Query("created_at", description="排序字段"),
    order: str = Query("desc", description="排序方向"),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Article)
    if status != "all":
        query = query.filter(Article.status == status)

    order_col = getattr(Article, sort_by, Article.created_at)
    if order == "desc":
        query = query.order_by(order_col.desc())
    else:
        query = query.order_by(order_col.asc())

    return query.limit(limit).all()


@router.get("/inbox", response_model=list[ArticleResponse])
def get_inbox(
    sort_by: str = Query("relevance_score", description="排序字段"),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    """获取收件箱（未读文章，按相关度排序）"""
    query = db.query(Article).filter(Article.is_read == False)
    order_col = getattr(Article, sort_by, Article.relevance_score)
    return query.order_by(order_col.desc()).limit(limit).all()


@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(404, "文章不存在")
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
def update_article(article_id: int, data: ArticleUpdate, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(404, "文章不存在")

    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("is_read") and not article.read_at:
        from datetime import datetime, timezone
        article.read_at = datetime.now(timezone.utc)

    for key, value in update_data.items():
        if value is not None:
            setattr(article, key, value)

    db.commit()
    db.refresh(article)
    return article


@router.post("/filter")
def filter_articles(req: ArticleFilterRequest, db: Session = Depends(get_db)):
    """对文章进行 AI 过滤"""
    service = AIFilterService(db)
    articles = service.filter_articles(req.article_ids if req.article_ids else None)

    high_count = sum(1 for a in articles if a.relevance_score >= 0.6)
    return {
        "filtered_articles": [
            {
                "id": a.id,
                "title": a.title,
                "summary": a.summary,
                "relevance_score": a.relevance_score,
                "relevance_reason": a.relevance_reason,
                "suggested_action": a.suggested_action,
            }
            for a in articles
        ],
        "total_count": len(articles),
        "high_relevance_count": high_count,
    }


@router.delete("/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(404, "文章不存在")
    db.delete(article)
    db.commit()
    return {"message": "已删除"}


@router.post("/fetch")
def fetch_articles(source_id: int = Query(None), db: Session = Depends(get_db)):
    """拉取信息源的文章"""
    fetcher = SourceFetcher(db)
    if source_id:
        articles = fetcher.fetch_source(source_id)
    else:
        articles = fetcher.fetch_all_sources()
    return {"message": f"拉取了 {len(articles)} 篇新文章"}
