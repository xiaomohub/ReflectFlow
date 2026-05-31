"""人格 Skills 多视角分析 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from models.database import get_db
from models.models import AppUser, Decision
from schemas import (
    SkillsAnalysisRequest, SkillsAnalysisResponse, PersonaAnalysis,
)
from services.skills_service import SkillsService, PERSONAS

router = APIRouter(prefix="/api/skills", tags=["人格分析"])


@router.get("/personas")
def list_personas():
    """列出所有可用的分析人格"""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "english_name": p["english_name"],
            "emoji": p["emoji"],
            "style": p["style"],
            "description": p["description"],
        }
        for p in PERSONAS
    ]


@router.post("/analyze", response_model=SkillsAnalysisResponse)
def analyze_decision(
    data: SkillsAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """对决策进行多视角人格分析"""
    service = SkillsService(db)

    # 转换 persona_ids: 空列表=全部, 有值=指定的
    persona_ids = data.persona_ids if data.persona_ids else None

    if data.decision_id:
        decision = db.query(Decision).filter(
            Decision.id == data.decision_id,
            Decision.owner_user_id == current_user.id,
        ).first()
        if not decision:
            raise HTTPException(404, "决策不存在")
        # 从数据库读取决策
        analyses = service.analyze_from_personas(data.decision_id, persona_ids)
        if not analyses:
            raise HTTPException(404, "决策不存在或分析失败")
    else:
        # 直接分析传过来的数据
        options_dicts = [o.model_dump() for o in data.options]
        analyses = service.analyze_direct(
            title=data.title,
            context=data.context,
            options=options_dicts,
            persona_ids=persona_ids,
        )

    return SkillsAnalysisResponse(
        analyses=[PersonaAnalysis(**a) for a in analyses]
    )
