"""Pydantic 数据模型 - API 请求/响应"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ===== 信息源 =====
class SourceBase(BaseModel):
    name: str
    source_type: str
    url: str
    description: str = ""
    enabled: bool = True
    fetch_interval: int = 3600
    tags: list = []
    config: dict = {}


class SourceCreate(SourceBase):
    pass


class SourceUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    fetch_interval: Optional[int] = None
    tags: Optional[list] = None
    config: Optional[dict] = None


class SourceResponse(SourceBase):
    id: int
    last_fetched_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== 文章 =====
class ArticleBase(BaseModel):
    title: str
    url: str = ""
    content: str = ""
    source_id: Optional[int] = None
    author: str = ""


class ArticleCreate(ArticleBase):
    pass


class ArticleUpdate(BaseModel):
    status: Optional[str] = None
    is_read: Optional[bool] = None
    is_starred: Optional[bool] = None
    summary: Optional[str] = None


class ArticleResponse(ArticleBase):
    id: int
    summary: str
    ai_analysis: dict
    relevance_score: float
    relevance_reason: str
    suggested_action: str
    status: str
    is_read: bool
    is_starred: bool
    created_at: datetime
    read_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class ArticleFilterRequest(BaseModel):
    """AI 过滤请求"""
    article_ids: list[int] = []


# ===== 用户领域上下文 =====
class UserContextBase(BaseModel):
    domain: str
    description: str = ""
    current_focus: str = ""
    goals: list = []
    priority: int = 5
    is_active: bool = True


class UserContextCreate(UserContextBase):
    pass


class UserContextUpdate(BaseModel):
    domain: Optional[str] = None
    description: Optional[str] = None
    current_focus: Optional[str] = None
    goals: Optional[list] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class UserContextResponse(UserContextBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== 决策 =====
class OptionItem(BaseModel):
    name: str
    pros: list[str] = []
    cons: list[str] = []
    score: float = 5.0


class DecisionBase(BaseModel):
    title: str
    description: str = ""
    context: str = ""
    article_id: Optional[int] = None
    related_domains: list = []
    options: list[OptionItem] = []
    chosen_option: str = ""
    rationale: str = ""
    ai_advice: str = ""
    ai_advice_used: bool = False
    status: str = "draft"
    confidence_score: int = 5
    review_interval_days: int = 30


class DecisionCreate(DecisionBase):
    pass


class DecisionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    context: Optional[str] = None
    options: Optional[list[OptionItem]] = None
    chosen_option: Optional[str] = None
    rationale: Optional[str] = None
    ai_advice: Optional[str] = None
    ai_advice_used: Optional[bool] = None
    status: Optional[str] = None
    confidence_score: Optional[int] = None
    review_interval_days: Optional[int] = None


class DecisionResponse(DecisionBase):
    id: int
    next_review_date: Optional[datetime] = None
    last_reviewed_at: Optional[datetime] = None
    created_at: datetime
    decided_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== 决策复盘 =====
class DecisionReviewBase(BaseModel):
    decision_id: int = 0
    outcome: str = ""
    outcome_score: int = 5
    lessons_learned: str = ""
    what_went_well: str = ""
    what_to_improve: str = ""
    next_steps: str = ""
    mood: str = "neutral"


class DecisionReviewCreate(DecisionReviewBase):
    pass


class DecisionReviewResponse(DecisionReviewBase):
    id: int
    review_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ===== AI 辅助 =====
class AIAdviceRequest(BaseModel):
    """请求 AI 决策建议"""
    title: str
    context: str = ""
    options: list[OptionItem] = []
    related_domains: list[str] = []


class AIAdviceResponse(BaseModel):
    advice: str
    recommended_option: Optional[str] = None
    analysis: str = ""


class AIFilterResponse(BaseModel):
    filtered_articles: list[dict]
    total_count: int
    high_relevance_count: int
