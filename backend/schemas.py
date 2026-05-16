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
    skip_filter: bool = False


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


class SourceImportItem(BaseModel):
    """批量导入的单个信息源"""
    name: str
    source_type: str = "rss"
    url: str
    description: str = ""
    tags: list = []
    enabled: bool = True
    skip_filter: bool = False
    config: dict = {}


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
    filtered_at: Optional[datetime] = None
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
    original_context: str = ""
    environment_snapshot: dict = {}
    article_id: Optional[int] = None
    category_id: Optional[int] = None
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
    environment_snapshot: dict = {}
    original_context: str = ""


class DecisionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    context: Optional[str] = None
    environment_snapshot: Optional[dict] = None
    options: Optional[list[OptionItem]] = None
    chosen_option: Optional[str] = None
    rationale: Optional[str] = None
    ai_advice: Optional[str] = None
    ai_advice_used: Optional[bool] = None
    status: Optional[str] = None
    confidence_score: Optional[int] = None
    review_interval_days: Optional[int] = None
    change_reason: Optional[str] = None
    category_id: Optional[int] = None


class DecisionResponse(DecisionBase):
    id: int
    next_review_date: Optional[datetime] = None
    environment_snapshot: dict = {}
    original_context: str = ""
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
    progress: str = ""
    adjusted_plan: str = ""
    is_progress_update: bool = False


class DecisionReviewCreate(DecisionReviewBase):
    progress: str = ""
    adjusted_plan: str = ""
    is_progress_update: bool = False


class DecisionReviewResponse(DecisionReviewBase):
    id: int
    review_date: datetime
    created_at: datetime
    progress: str = ""
    adjusted_plan: str = ""
    is_progress_update: bool = False

    class Config:
        from_attributes = True


class DecisionChangeLogResponse(BaseModel):
    """决策变更记录"""
    id: int
    decision_id: int
    changed_at: datetime
    field_name: str
    old_value: str = ""
    new_value: str = ""
    change_reason: str = ""

    class Config:
        from_attributes = True


# ===== 决策分类 =====
class DecisionCategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    sort_order: int = 0
    description: str = ""


class DecisionCategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    description: Optional[str] = None


class DecisionCategoryResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    sort_order: int = 0
    description: str = ""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== 批量操作 =====
class BatchFilters(BaseModel):
    """跨页全选的筛选条件"""
    select_all: bool = False
    status: str | None = None
    is_read: bool | None = None
    domain: str | None = None
    source_id: int | None = None
    suggested_action: str | None = None


class BatchUpdateRequest(BaseModel):
    article_ids: list[int] = []
    updates: dict = {}
    filters: BatchFilters = BatchFilters()


class BatchDeleteRequest(BaseModel):
    article_ids: list[int] = []
    filters: BatchFilters = BatchFilters()


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


class ArticlePageResponse(BaseModel):
    """分页文章列表"""
    items: list[ArticleResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ===== 笔记 =====
class NoteCategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    sort_order: int = 0
    description: str = ""


class NoteCategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    description: Optional[str] = None


class NoteCategoryResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    sort_order: int = 0
    description: str = ""
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    category_id: Optional[int] = None
    tags: list = []
    is_published: bool = True


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[int] = None
    tags: Optional[list] = None
    is_published: Optional[bool] = None


class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    category_id: Optional[int] = None
    tags: list = []
    is_published: bool = True
    ai_skills: list = []
    word_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== 人格 Skills 分析 =====
class SkillsAnalysisRequest(BaseModel):
    """请求人格 Skills 分析"""
    decision_id: int | None = None
    title: str = ""
    context: str = ""
    options: list[OptionItem] = []
    persona_ids: list[str] = []


class PersonaAnalysis(BaseModel):
    """单个人格的分析结果"""
    persona_id: str
    persona_name: str
    persona_style: str
    emoji: str
    analysis: str
    advice: str
    confidence: int = 5
    key_questions: list[str] = []
    risk_warnings: list[str] = []


class SkillsAnalysisResponse(BaseModel):
    analyses: list[PersonaAnalysis]


class CategoryCount(BaseModel):
    """分类统计"""
    name: str
    count: int


class ArticleCategoriesResponse(BaseModel):
    """文章分类聚合"""
    by_source: list[CategoryCount]
    by_action: list[CategoryCount]
    by_status: list[CategoryCount]
    by_domain: list[CategoryCount] = []
    total: int
    unread: int
    schema_version: str = "v2"
    _schema_version: str = "v2_has_by_domain"


# ===== 系统设置 =====
class SettingUpdate(BaseModel):
    """更新系统设置"""
    auto_fetch_enabled: bool = False
    auto_fetch_interval_hours: int = 12
    important_figures: str = ""
    sensitive_words: str = ""


class SettingResponse(BaseModel):
    auto_fetch_enabled: bool
    auto_fetch_interval_hours: int
    important_figures: str = ""
    sensitive_words: str = ""
