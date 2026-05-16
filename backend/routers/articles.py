"""文章管理 & AI 过滤 API"""

import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from models.database import get_db
from models.models import Article, Source, UserContext
from schemas import (
    ArticleUpdate, ArticleResponse, ArticleFilterRequest,
    ArticlePageResponse, ArticleCategoriesResponse, CategoryCount,
)
from services.ai_filter import AIFilterService
from services.source_fetcher import SourceFetcher
from utils import beijing_now
from schemas import BatchUpdateRequest, BatchDeleteRequest

router = APIRouter(prefix="/api/articles", tags=["文章"])


@router.get("/", response_model=ArticlePageResponse)
def list_articles(
    status: str = Query("new", description="筛选状态: new/reviewed/archived/actioned/all"),
    is_read: bool = Query(None, description="按已读状态筛选"),
    sort_by: str = Query("created_at", description="排序字段"),
    order: str = Query("desc", description="排序方向"),
    source_id: int = Query(None, description="按信息源筛选"),
    tag: str = Query(None, description="按标签筛选"),
    domain: str = Query(None, description="按关注领域筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
):
    query = db.query(Article)

    if status != "all":
        query = query.filter(Article.status == status)

    if is_read is not None:
        query = query.filter(Article.is_read == is_read)

    if source_id:
        query = query.filter(Article.source_id == source_id)

    if tag:
        query = query.filter(Article.ai_analysis["tags"].as_string().ilike(f"%{tag}%"))

    if domain:
        domain_filter = f"%{domain}%"
        from sqlalchemy import or_
        query = query.filter(
            or_(
                Article.relevance_reason.ilike(domain_filter),
                Article.ai_analysis["matched_domains"].as_string().ilike(domain_filter),
            )
        )

    total = query.count()
    order_col = getattr(Article, sort_by, Article.created_at)
    order_func = order_col.desc if order == "desc" else order_col.asc
    items = query.order_by(order_func()).offset((page - 1) * page_size).limit(page_size).all()

    return ArticlePageResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/categories_test")
def get_article_categories_test(db: Session = Depends(get_db)):
    """DEBUG: Return plain dict to verify by_domain"""
    from models.models import UserContext
    domains = db.query(UserContext).filter(UserContext.is_active == True).all()
    return {
        "domain_count": len(domains),
        "domain_names": [d.domain for d in domains],
        "has_by_domain": True,
    }

@router.get("/categories", response_model=ArticleCategoriesResponse)
def get_article_categories(db: Session = Depends(get_db)):
    """获取文章分类聚合统计"""
    total = db.query(Article).count()
    unread = db.query(Article).filter(Article.is_read == False).count()

    # 按来源统计
    source_counts = (
        db.query(Source.name, func.count(Article.id))
        .outerjoin(Article, Source.id == Article.source_id)
        .group_by(Source.name)
        .all()
    )
    by_source = [CategoryCount(name=name, count=count) for name, count in source_counts]

    # 按建议操作统计
    action_counts = (
        db.query(Article.suggested_action, func.count(Article.id))
        .filter(Article.suggested_action != "", Article.suggested_action.isnot(None))
        .group_by(Article.suggested_action)
        .all()
    )
    action_labels = {"read": "值得读", "archive": "可存档", "decide": "需决策", "ignore": "忽略"}
    by_action = [
        CategoryCount(name=action_labels.get(action, action), count=count)
        for action, count in action_counts
    ]

    # 按状态统计
    status_counts = (
        db.query(Article.status, func.count(Article.id))
        .group_by(Article.status)
        .all()
    )
    status_labels = {"new": "新文章", "reviewed": "已读", "archived": "已存档", "actioned": "已处理"}
    by_status = [
        CategoryCount(name=status_labels.get(st, st), count=count)
        for st, count in status_counts
    ]

    # 按关注领域统计 - 遍历已过滤文章，匹配 relevance_reason 和 ai_analysis
    domains = db.query(UserContext).filter(UserContext.is_active == True).all()
    filtered_articles = db.query(Article).filter(Article.filtered_at.isnot(None)).all()
    by_domain = []
    for domain in domains:
        domain_lower = domain.domain.lower()
        count = 0
        for article in filtered_articles:
            if domain_lower in article.relevance_reason.lower():
                count += 1
                continue
            if article.ai_analysis and isinstance(article.ai_analysis, dict):
                # 检查 ai_analysis 中的 matched_domains（精确匹配）
                matched = article.ai_analysis.get("matched_domains", [])
                if any(d.lower() == domain_lower for d in matched):
                    count += 1
                    continue
                # 检查 tags 模糊匹配
                tags = article.ai_analysis.get("tags", [])
                if any(domain_lower in tag.lower() for tag in tags):
                    count += 1
                    continue
        if count > 0:
            by_domain.append(CategoryCount(name=domain.domain, count=count))

    return ArticleCategoriesResponse(
        by_source=by_source,
        by_action=by_action,
        by_status=by_status,
        by_domain=by_domain,
        total=total,
        unread=unread,
    )


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
        article.read_at = beijing_now()

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


@router.post("/batch-update")
def batch_update_articles(req: BatchUpdateRequest, db: Session = Depends(get_db)):
    """批量更新文章（支持跨页全选）"""
    if req.filters.select_all:
        query = db.query(Article)
        if req.filters.status is not None:
            query = query.filter(Article.status == req.filters.status)
        if req.filters.is_read is not None:
            query = query.filter(Article.is_read == req.filters.is_read)
        if req.filters.source_id is not None:
            query = query.filter(Article.source_id == req.filters.source_id)
        if req.filters.suggested_action is not None:
            query = query.filter(Article.suggested_action == req.filters.suggested_action)
        if req.filters.domain is not None:
            from sqlalchemy import or_
            domain_filter = f"%{req.filters.domain}%"
            query = query.filter(
                or_(
                    Article.relevance_reason.ilike(domain_filter),
                    Article.ai_analysis["matched_domains"].as_string().ilike(domain_filter),
                )
            )
        articles = query.all()
    else:
        articles = db.query(Article).filter(Article.id.in_(req.article_ids)).all()
    updated = 0
    for article in articles:
        for key, value in req.updates.items():
            if value is not None:
                setattr(article, key, value)
        if req.updates.get("is_read") and not article.read_at:
            article.read_at = beijing_now()
        updated += 1
    db.commit()
    return {"message": f"已更新 {updated} 篇文章"}


@router.post("/batch-delete")
def batch_delete_articles(req: BatchDeleteRequest, db: Session = Depends(get_db)):
    """批量删除文章（支持跨页全选）"""
    if req.filters.select_all:
        query = db.query(Article)
        if req.filters.status is not None:
            query = query.filter(Article.status == req.filters.status)
        if req.filters.is_read is not None:
            query = query.filter(Article.is_read == req.filters.is_read)
        if req.filters.source_id is not None:
            query = query.filter(Article.source_id == req.filters.source_id)
        if req.filters.suggested_action is not None:
            query = query.filter(Article.suggested_action == req.filters.suggested_action)
        if req.filters.domain is not None:
            from sqlalchemy import or_
            domain_filter = f"%{req.filters.domain}%"
            query = query.filter(
                or_(
                    Article.relevance_reason.ilike(domain_filter),
                    Article.ai_analysis["matched_domains"].as_string().ilike(domain_filter),
                )
            )
        deleted = query.delete(synchronize_session=False)
    else:
        deleted = db.query(Article).filter(Article.id.in_(req.article_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": f"已删除 {deleted} 篇文章"}


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
