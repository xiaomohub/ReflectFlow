"""SQLAlchemy 数据模型定义"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, JSON, ForeignKey
from models.database import Base


class Source(Base):
    """信息源配置"""
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, comment="信息源名称")
    source_type = Column(String(50), nullable=False, comment="类型: rss/webpage/newsletter/api")
    url = Column(String(500), nullable=False, comment="信息源地址")
    description = Column(Text, default="", comment="描述")
    enabled = Column(Boolean, default=True, comment="是否启用")
    fetch_interval = Column(Integer, default=3600, comment="拉取间隔(秒)")
    last_fetched_at = Column(DateTime, nullable=True, comment="上次拉取时间")
    tags = Column(JSON, default=list, comment="标签")
    config = Column(JSON, default=dict, comment="额外配置，如 Cookie、Headers 等")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Article(Base):
    """从信息源获取的文章/信息"""
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=True)
    title = Column(String(500), nullable=False)
    url = Column(String(500), default="")
    content = Column(Text, default="", comment="原文内容")
    summary = Column(Text, default="", comment="AI 摘要")
    author = Column(String(200), default="")

    # AI 分析结果
    ai_analysis = Column(JSON, default=dict, comment="AI 分析的完整结果")
    relevance_score = Column(Float, default=0.0, comment="相关度评分 0-1")
    relevance_reason = Column(Text, default="", comment="相关原因说明")
    suggested_action = Column(String(50), default="", comment="AI 建议操作: read/archive/decide/ignore")

    # 状态管理
    status = Column(String(20), default="new", comment="new/reviewed/archived/actioned")
    is_read = Column(Boolean, default=False)
    is_starred = Column(Boolean, default=False, comment="是否标星")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    read_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class UserContext(Base):
    """用户当前关注领域/上下文"""
    __tablename__ = "user_contexts"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(200), nullable=False, comment="领域名称")
    description = Column(Text, default="", comment="领域描述")
    current_focus = Column(Text, default="", comment="当前重点关注方向")
    goals = Column(JSON, default=list, comment="当前目标列表")
    priority = Column(Integer, default=5, comment="优先级 1-10")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Decision(Base):
    """决策记录"""
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, default="")
    context = Column(Text, default="", comment="触发此决策的背景")

    # 关联
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=True, comment="触发文章")
    related_domains = Column(JSON, default=list, comment="关联领域")

    # 决策选项
    options = Column(JSON, default=list, comment="考虑的选项列表 [{name, pros, cons, score}]")
    chosen_option = Column(String(200), default="", comment="最终选择")
    rationale = Column(Text, default="", comment="决策理由")

    # AI 辅助
    ai_advice = Column(Text, default="", comment="AI 建议")
    ai_advice_used = Column(Boolean, default=False, comment="是否采纳 AI 建议")

    # 状态
    status = Column(String(20), default="draft", comment="draft/active/completed/abandoned")
    confidence_score = Column(Integer, default=5, comment="信心评分 1-10")

    # 复盘
    review_interval_days = Column(Integer, default=30, comment="复盘周期(天)")
    next_review_date = Column(DateTime, nullable=True, comment="下次复盘日期")
    last_reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    decided_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class DecisionReview(Base):
    """决策复盘记录"""
    __tablename__ = "decision_reviews"

    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer, ForeignKey("decisions.id"), nullable=False)

    review_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    outcome = Column(Text, default="", comment="实际结果")
    outcome_score = Column(Integer, default=5, comment="结果评分 1-10 (10=完全达到预期)")
    lessons_learned = Column(Text, default="", comment="经验教训")
    what_went_well = Column(Text, default="", comment="做得好的")
    what_to_improve = Column(Text, default="", comment="待改进")
    next_steps = Column(Text, default="", comment="后续行动")
    mood = Column(String(50), default="neutral", comment="心情标记")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
