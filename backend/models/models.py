"""SQLAlchemy 数据模型定义"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from models.database import Base
from utils import beijing_now


class AppUser(Base):
    """系统人员（管理员/普通人员）"""
    __tablename__ = "app_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True, comment="登录名/唯一标识")
    display_name = Column(String(200), nullable=False, comment="显示名称")
    role = Column(String(20), default="normal", comment="角色：admin/normal")
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime, default=lambda: beijing_now())
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


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
    skip_filter = Column(Boolean, default=False, comment="跳过 AI 过滤，保留全部文章")
    category_id = Column(Integer, ForeignKey("source_categories.id"), nullable=True, comment="所属分类")
    created_at = Column(DateTime, default=lambda: beijing_now())
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


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

    # AI 过滤标记
    filtered_at = Column(DateTime, nullable=True, comment="AI 过滤时间")

    # 状态管理
    status = Column(String(20), default="new", comment="new/reviewed/archived/actioned")
    is_read = Column(Boolean, default=False)
    is_starred = Column(Boolean, default=False, comment="是否标星")

    created_at = Column(DateTime, default=lambda: beijing_now())
    read_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


class UserContext(Base):
    """用户当前关注领域/上下文"""
    __tablename__ = "user_contexts"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False, default=1, index=True, comment="所属人员")
    domain = Column(String(200), nullable=False, comment="领域名称")
    description = Column(Text, default="", comment="领域描述")
    current_focus = Column(Text, default="", comment="当前重点关注方向")
    goals = Column(JSON, default=list, comment="当前目标列表")
    priority = Column(Integer, default=5, comment="优先级 1-10")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: beijing_now())
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


class Decision(Base):
    """决策记录"""
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False, default=1, index=True, comment="所属人员")
    title = Column(String(500), nullable=False)
    description = Column(Text, default="")
    context = Column(Text, default="", comment="触发此决策的背景")
    original_context = Column(Text, default="", comment="创建时的背景快照（不可变）")
    environment_snapshot = Column(JSON, default=dict, comment="决策时的外部环境快照（市场状况、时间等）")

    # 关联
    article_id = Column(Integer, ForeignKey("articles.id"), nullable=True, comment="触发文章")
    category_id = Column(Integer, ForeignKey("decision_categories.id"), nullable=True, comment="所属分类")
    parent_decision_id = Column(Integer, ForeignKey("decisions.id"), nullable=True, comment="父决策（决策树串联）")
    root_decision_id = Column(Integer, ForeignKey("decisions.id"), nullable=True, index=True, comment="树根决策")
    node_order = Column(Integer, default=0, comment="同层顺序")
    related_domains = Column(JSON, default=list, comment="关联领域")
    children = relationship("Decision", backref="parent", remote_side="Decision.id", viewonly=True)

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

    created_at = Column(DateTime, default=lambda: beijing_now())
    decided_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


class DecisionReview(Base):
    """决策复盘记录"""
    __tablename__ = "decision_reviews"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False, default=1, index=True, comment="所属人员")
    decision_id = Column(Integer, ForeignKey("decisions.id"), nullable=False)

    review_date = Column(DateTime, default=lambda: beijing_now())
    outcome = Column(Text, default="", comment="实际结果")
    outcome_score = Column(Integer, default=5, comment="结果评分 1-10 (10=完全达到预期)")
    lessons_learned = Column(Text, default="", comment="经验教训")
    what_went_well = Column(Text, default="", comment="做得好的")
    what_to_improve = Column(Text, default="", comment="待改进")
    next_steps = Column(Text, default="", comment="后续行动")
    mood = Column(String(50), default="neutral", comment="心情标记")
    progress = Column(Text, default="", comment="进展说明（用于进行中决策的持续跟踪）")
    adjusted_plan = Column(Text, default="", comment="调整计划（基于当前进展的下一步调整）")
    is_progress_update = Column(Boolean, default=False, comment="是否为进展更新而非最终结论")

    created_at = Column(DateTime, default=lambda: beijing_now())


class DecisionChangeLog(Base):
    """决策变更记录"""
    __tablename__ = "decision_changelogs"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False, default=1, index=True, comment="所属人员")
    decision_id = Column(Integer, ForeignKey("decisions.id"), nullable=False, index=True)
    changed_at = Column(DateTime, default=lambda: beijing_now(), comment="变更时间")
    field_name = Column(String(100), nullable=False, comment="变更字段")
    old_value = Column(Text, default="", comment="旧值")
    new_value = Column(Text, default="", comment="新值")
    change_reason = Column(String(500), default="", comment="变更原因（可选）")


class DecisionCategory(Base):
    """决策分类/文件夹"""
    __tablename__ = "decision_categories"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False, default=1, index=True, comment="所属人员")
    name = Column(String(200), nullable=False, comment="分类名称")
    parent_id = Column(Integer, ForeignKey("decision_categories.id"), nullable=True, comment="父分类")
    sort_order = Column(Integer, default=0, comment="排序")
    description = Column(Text, default="", comment="描述")
    created_at = Column(DateTime, default=lambda: beijing_now())
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


class NoteCategory(Base):
    """笔记分类/文件夹"""
    __tablename__ = "note_categories"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False, default=1, index=True, comment="所属人员")
    name = Column(String(200), nullable=False, comment="分类名称")
    parent_id = Column(Integer, ForeignKey("note_categories.id"), nullable=True, comment="父分类")
    sort_order = Column(Integer, default=0, comment="排序")
    description = Column(Text, default="", comment="描述")
    created_at = Column(DateTime, default=lambda: beijing_now())
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


class Note(Base):
    """Markdown 笔记"""
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=False, default=1, index=True, comment="所属人员")
    title = Column(String(500), nullable=False, comment="标题")
    content = Column(Text, default="", comment="Markdown 内容")
    category_id = Column(Integer, ForeignKey("note_categories.id"), nullable=True, comment="所属分类")
    tags = Column(JSON, default=list, comment="标签列表")
    is_published = Column(Boolean, default=True, comment="是否公开")
    ai_skills = Column(JSON, default=list, comment="AI 提取的技能/方法论列表")
    decision_id = Column(Integer, ForeignKey("decisions.id"), nullable=True, comment="关联决策")
    word_count = Column(Integer, default=0, comment="字数")
    created_at = Column(DateTime, default=lambda: beijing_now())
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


class SourceCategory(Base):
    """信息源分类"""
    __tablename__ = "source_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, comment="分类名称")
    parent_id = Column(Integer, ForeignKey("source_categories.id"), nullable=True, comment="父分类")
    sort_order = Column(Integer, default=0, comment="排序")
    description = Column(Text, default="", comment="描述")
    created_at = Column(DateTime, default=lambda: beijing_now())
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())


class Setting(Base):
    """应用设置（键值对）"""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, comment="设置键")
    value = Column(Text, default="", comment="设置值")
    description = Column(String(500), default="", comment="描述")
    updated_at = Column(DateTime, default=lambda: beijing_now(), onupdate=lambda: beijing_now())
