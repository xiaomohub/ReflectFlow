"""决策管理 & AI 辅助决策 API"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from models.database import get_db
from models.models import Decision
from schemas import (
    DecisionCreate, DecisionUpdate, DecisionResponse,
    DecisionReviewCreate, DecisionReviewResponse,
    AIAdviceRequest, AIAdviceResponse,
)
from services.ai_filter import AIFilterService
from services.decision_service import DecisionService

router = APIRouter(prefix="/api/decisions", tags=["决策"])


@router.get("/", response_model=list[DecisionResponse])
def list_decisions(
    status: str = Query("all", description="筛选状态"),
    db: Session = Depends(get_db),
):
    query = db.query(Decision)
    if status != "all":
        query = query.filter(Decision.status == status)
    return query.order_by(Decision.created_at.desc()).all()


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
