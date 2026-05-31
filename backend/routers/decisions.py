"""决策管理 & AI 辅助决策 API"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from math import ceil

from auth import get_current_user
from models.database import get_db
from models.models import (
    AppUser,
    Decision,
    DecisionCategory,
    DecisionChangeLog,
    DecisionReview,
    Note,
)
from schemas import (
    DecisionCreate, DecisionUpdate, DecisionResponse,
    DecisionTreeNodeResponse,
    DecisionReviewCreate, DecisionReviewResponse,
    DecisionChangeLogResponse,
    DecisionCategoryCreate, DecisionCategoryUpdate, DecisionCategoryResponse,
    AIAdviceRequest, AIAdviceResponse,
)
from services.ai_filter import AIFilterService
from services.decision_service import DecisionService

router = APIRouter(prefix="/api/decisions", tags=["决策"])


def _build_tree_node(db: Session, node: Decision, owner_user_id: int) -> DecisionTreeNodeResponse:
    children = db.query(Decision).filter(
        Decision.parent_decision_id == node.id,
        Decision.owner_user_id == owner_user_id,
    ).order_by(Decision.node_order.asc(), Decision.created_at.asc()).all()
    return DecisionTreeNodeResponse(
        id=node.id,
        title=node.title,
        status=node.status,
        confidence_score=node.confidence_score,
        parent_decision_id=node.parent_decision_id,
        root_decision_id=node.root_decision_id,
        node_order=node.node_order or 0,
        next_review_date=node.next_review_date,
        created_at=node.created_at,
        children=[_build_tree_node(db, child, owner_user_id) for child in children],
    )


def _update_subtree_root(db: Session, node_id: int, root_id: int, owner_user_id: int) -> None:
    stack = [node_id]
    while stack:
        current = stack.pop()
        db.query(Decision).filter(
            Decision.id == current,
            Decision.owner_user_id == owner_user_id,
        ).update(
            {Decision.root_decision_id: root_id},
            synchronize_session=False,
        )
        child_ids = db.query(Decision.id).filter(
            Decision.parent_decision_id == current,
            Decision.owner_user_id == owner_user_id,
        ).all()
        stack.extend([child_id for (child_id,) in child_ids])


# ===== 决策分类 CRUD =====

@router.get("/categories", response_model=list[DecisionCategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    return db.query(DecisionCategory).filter(
        DecisionCategory.owner_user_id == current_user.id
    ).order_by(DecisionCategory.sort_order).all()


@router.post("/categories", response_model=DecisionCategoryResponse)
def create_category(
    data: DecisionCategoryCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    cat = DecisionCategory(**data.model_dump(), owner_user_id=current_user.id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categories/{category_id}", response_model=DecisionCategoryResponse)
def update_category(
    category_id: int,
    data: DecisionCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    cat = db.query(DecisionCategory).filter(
        DecisionCategory.id == category_id,
        DecisionCategory.owner_user_id == current_user.id,
    ).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    for key, value in update_data.items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    cat = db.query(DecisionCategory).filter(
        DecisionCategory.id == category_id,
        DecisionCategory.owner_user_id == current_user.id,
    ).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    # 将该分类下的决策置为无分类
    db.query(Decision).filter(
        Decision.category_id == category_id,
        Decision.owner_user_id == current_user.id,
    ).update(
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
    current_user: AppUser = Depends(get_current_user),
):
    query = db.query(Decision).filter(Decision.owner_user_id == current_user.id)
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
def get_stats(
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    service = DecisionService(db, current_user)
    return service.get_decisions_overview()


@router.get("/due-reviews", response_model=list[DecisionResponse])
def get_due_reviews(
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    service = DecisionService(db, current_user)
    return service.get_due_reviews()


@router.post("/", response_model=DecisionResponse)
def create_decision(
    data: DecisionCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    service = DecisionService(db, current_user)
    try:
        return service.create_decision(data.model_dump())
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{decision_id}", response_model=DecisionResponse)
def get_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(404, "决策不存在")
    return decision


@router.put("/{decision_id}", response_model=DecisionResponse)
def update_decision(
    decision_id: int,
    data: DecisionUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    service = DecisionService(db, current_user)
    try:
        decision = service.update_decision(decision_id, data.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not decision:
        raise HTTPException(404, "决策不存在")
    return decision


@router.delete("/{decision_id}")
def delete_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(404, "决策不存在")
    # 清理关联引用，避免残留脏数据
    child_ids = [child_id for (child_id,) in db.query(Decision.id).filter(
        Decision.parent_decision_id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).all()]
    db.query(Decision).filter(
        Decision.parent_decision_id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).update(
        {Decision.parent_decision_id: decision.parent_decision_id},
        synchronize_session=False,
    )
    if decision.parent_decision_id is None:
        for child_id in child_ids:
            _update_subtree_root(db, child_id, child_id, current_user.id)
    db.query(Note).filter(
        Note.decision_id == decision_id,
        Note.owner_user_id == current_user.id,
    ).update({Note.decision_id: None})
    db.query(DecisionReview).filter(
        DecisionReview.decision_id == decision_id,
        DecisionReview.owner_user_id == current_user.id,
    ).delete(
        synchronize_session=False
    )
    db.query(DecisionChangeLog).filter(
        DecisionChangeLog.decision_id == decision_id,
        DecisionChangeLog.owner_user_id == current_user.id,
    ).delete(synchronize_session=False)
    db.delete(decision)
    db.commit()
    return {"message": "已删除"}


@router.get("/{decision_id}/path", response_model=list[DecisionResponse])
def get_decision_path(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """获取从根节点到当前节点的路径"""
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(404, "决策不存在")

    path = []
    visited = set()
    current = decision
    while current and current.id not in visited:
        path.append(current)
        visited.add(current.id)
        if current.parent_decision_id is None:
            break
        current = db.query(Decision).filter(
            Decision.id == current.parent_decision_id,
            Decision.owner_user_id == current_user.id,
        ).first()
    return list(reversed(path))


@router.get("/{decision_id}/tree", response_model=DecisionTreeNodeResponse)
def get_decision_tree(
    decision_id: int,
    from_root: bool = Query(True, description="是否从根节点返回整棵树"),
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """获取决策树"""
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(404, "决策不存在")
    if from_root:
        root_id = decision.root_decision_id or decision.id
        root = db.query(Decision).filter(
            Decision.id == root_id,
            Decision.owner_user_id == current_user.id,
        ).first()
        if root:
            return _build_tree_node(db, root, current_user.id)
    return _build_tree_node(db, decision, current_user.id)


@router.get("/{decision_id}/children", response_model=list[DecisionResponse])
def get_decision_children(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """获取决策的子决策（决策树中的下级节点）"""
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(404, "决策不存在")
    children = db.query(Decision).filter(
        Decision.parent_decision_id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).order_by(Decision.node_order.asc(), Decision.created_at.asc()).all()
    return children


@router.post("/{decision_id}/children", response_model=DecisionResponse)
def create_child_decision(
    decision_id: int,
    data: DecisionCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """在当前决策下创建子决策"""
    parent = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).first()
    if not parent:
        raise HTTPException(404, "父决策不存在")
    service = DecisionService(db, current_user)
    payload = data.model_dump()
    payload["parent_decision_id"] = decision_id
    try:
        return service.create_decision(payload)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{decision_id}/reviews", response_model=DecisionReviewResponse)
def add_review(
    decision_id: int,
    data: DecisionReviewCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    service = DecisionService(db, current_user)
    review = service.add_review(decision_id, data.model_dump())
    if not review:
        raise HTTPException(404, "决策不存在")
    return review


@router.get("/{decision_id}/reviews", response_model=list[DecisionReviewResponse])
def get_reviews(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    service = DecisionService(db, current_user)
    return service.get_review_history(decision_id)


@router.delete("/{decision_id}/reviews/{review_id}")
def delete_review(
    decision_id: int,
    review_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    from models.models import DecisionReview
    review = db.query(DecisionReview).filter(
        DecisionReview.id == review_id,
        DecisionReview.decision_id == decision_id,
        DecisionReview.owner_user_id == current_user.id,
    ).first()
    if not review:
        raise HTTPException(404, "复盘记录不存在")
    db.delete(review)
    db.commit()
    return {"message": "已删除"}


@router.get("/{decision_id}/changelog", response_model=list[DecisionChangeLogResponse])
def get_changelog(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """获取决策的变更历史"""
    decision = db.query(Decision).filter(
        Decision.id == decision_id,
        Decision.owner_user_id == current_user.id,
    ).first()
    if not decision:
        raise HTTPException(404, "决策不存在")
    service = DecisionService(db, current_user)
    return service.get_change_log(decision_id)


@router.post("/ai-advice", response_model=AIAdviceResponse)
def get_ai_advice(
    data: AIAdviceRequest,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """请求 AI 决策建议"""
    service = AIFilterService(db)
    previous_ids = data.previous_decision_ids or []
    if previous_ids:
        owned_ids = db.query(Decision.id).filter(
            Decision.id.in_(previous_ids),
            Decision.owner_user_id == current_user.id,
        ).all()
        previous_ids = [x for (x,) in owned_ids]
    result = service.get_decision_advice(
        title=data.title,
        context=data.context,
        options=[o.model_dump() for o in data.options],
        related_domains=data.related_domains,
        previous_decision_ids=previous_ids,
    )
    return AIAdviceResponse(
        advice=result.get("advice", ""),
        recommended_option=result.get("recommended_option"),
        analysis=result.get("analysis", ""),
        risk_warnings=result.get("risk_warnings", []),
    )
