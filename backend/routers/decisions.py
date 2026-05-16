"""决策管理 & AI 辅助决策 API"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from math import ceil

from models.database import get_db
from models.models import Decision, DecisionCategory
from schemas import (
    DecisionCreate, DecisionUpdate, DecisionResponse,
    DecisionReviewCreate, DecisionReviewResponse,
    DecisionChangeLogResponse,
    DecisionCategoryCreate, DecisionCategoryUpdate, DecisionCategoryResponse,
    AIAdviceRequest, AIAdviceResponse,
)
from services.ai_filter import AIFilterService
from services.decision_service import DecisionService

router = APIRouter(prefix="/api/decisions", tags=["决策"])


# ===== 决策分类 CRUD =====

@router.get("/categories", response_model=list[DecisionCategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return db.query(DecisionCategory).order_by(DecisionCategory.sort_order).all()


@router.post("/categories", response_model=DecisionCategoryResponse)
def create_category(data: DecisionCategoryCreate, db: Session = Depends(get_db)):
    cat = DecisionCategory(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categories/{category_id}", response_model=DecisionCategoryResponse)
def update_category(category_id: int, data: DecisionCategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(DecisionCategory).filter(DecisionCategory.id == category_id).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    for key, value in update_data.items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(DecisionCategory).filter(DecisionCategory.id == category_id).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    # 将该分类下的决策置为无分类
    db.query(Decision).filter(Decision.category_id == category_id).update(
        {Decision.category_id: None}
    )
    db.delete(cat)
    db.commit()
    return {"message": "已删除"}


# ===== 决策 CRUD（带分页 + 分类筛选）=====

@router.get("/", response_model=dict)
def list_decisions(
    status: str = Query("all", description="筛选状态"),
    category_id: int = Query(None, description="按分类筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
):
    query = db.query(Decision)
    if status != "all":
        query = query.filter(Decision.status == status)
    if category_id is not None:
        query = query.filter(Decision.category_id == category_id)
    total = query.count()
    items = query.order_by(Decision.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return {
        "items": [DecisionResponse.model_validate(i).model_dump(mode="json") for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, ceil(total / page_size)),
    }


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    service = DecisionService(db)
    return service.get_decisions_overview()


@router.get("/due-reviews", response_model=list[DecisionResponse])
def get_due_reviews(db: Session = Depends(get_db)):
    service = DecisionService(db)
    return service.get_due_reviews()


@router.post("/", response_model=DecisionResponse)
def create_decision(data: DecisionCreate, db: Session = Depends(get_db)):
    service = DecisionService(db)
    return service.create_decision(data.model_dump())


@router.get("/{decision_id}", response_model=DecisionResponse)
def get_decision(decision_id: int, db: Session = Depends(get_db)):
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(404, "决策不存在")
    return decision


@router.put("/{decision_id}", response_model=DecisionResponse)
def update_decision(decision_id: int, data: DecisionUpdate, db: Session = Depends(get_db)):
    service = DecisionService(db)
    decision = service.update_decision(decision_id, data.model_dump(exclude_unset=True))
    if not decision:
        raise HTTPException(404, "决策不存在")
    return decision


@router.delete("/{decision_id}")
def delete_decision(decision_id: int, db: Session = Depends(get_db)):
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(404, "决策不存在")
    db.delete(decision)
    db.commit()
    return {"message": "已删除"}


@router.post("/{decision_id}/reviews", response_model=DecisionReviewResponse)
def add_review(decision_id: int, data: DecisionReviewCreate, db: Session = Depends(get_db)):
    service = DecisionService(db)
    review = service.add_review(decision_id, data.model_dump())
    if not review:
        raise HTTPException(404, "决策不存在")
    return review


@router.get("/{decision_id}/reviews", response_model=list[DecisionReviewResponse])
def get_reviews(decision_id: int, db: Session = Depends(get_db)):
    service = DecisionService(db)
    return service.get_review_history(decision_id)


@router.delete("/{decision_id}/reviews/{review_id}")
def delete_review(decision_id: int, review_id: int, db: Session = Depends(get_db)):
    from models.models import DecisionReview
    review = db.query(DecisionReview).filter(
        DecisionReview.id == review_id,
        DecisionReview.decision_id == decision_id,
    ).first()
    if not review:
        raise HTTPException(404, "复盘记录不存在")
    db.delete(review)
    db.commit()
    return {"message": "已删除"}


@router.get("/{decision_id}/changelog", response_model=list[DecisionChangeLogResponse])
def get_changelog(decision_id: int, db: Session = Depends(get_db)):
    """获取决策的变更历史"""
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(404, "决策不存在")
    service = DecisionService(db)
    return service.get_change_log(decision_id)


@router.post("/ai-advice", response_model=AIAdviceResponse)
def get_ai_advice(data: AIAdviceRequest, db: Session = Depends(get_db)):
    """请求 AI 决策建议"""
    service = AIFilterService(db)
    result = service.get_decision_advice(
        title=data.title,
        context=data.context,
        options=[o.model_dump() for o in data.options],
        related_domains=data.related_domains,
    )
    return AIAdviceResponse(
        advice=result.get("advice", ""),
        recommended_option=result.get("recommended_option"),
        analysis=result.get("analysis", ""),
    )
