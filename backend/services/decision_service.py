"""决策复盘服务 - 决策管理和复盘分析"""

import json
from datetime import timedelta
from typing import Optional
from sqlalchemy.orm import Session

from models.models import Decision, DecisionReview, DecisionChangeLog
from utils import beijing_now


STATUS_TRANSITIONS = {
    "draft": ["active"],
    "active": ["completed", "abandoned"],
    "completed": ["active"],
    "abandoned": ["active"],
}


class DecisionService:
    """决策管理服务"""

    def __init__(self, db: Session):
        self.db = db

    def create_decision(self, data: dict) -> Decision:
        """创建新决策 - 自动保存 original_context 快照"""
        # 分离 environment_snapshot 和 original_context
        snapshot = data.pop("environment_snapshot", {})
        orig_ctx = data.pop("original_context", "") or data.get("context", "")

        decision = Decision(**{k: v for k, v in data.items() if hasattr(Decision, k)})
        decision.original_context = orig_ctx
        decision.environment_snapshot = snapshot
        decision.next_review_date = beijing_now() + timedelta(
            days=data.get("review_interval_days", 30)
        )
        self.db.add(decision)
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def update_decision(self, decision_id: int, data: dict) -> Optional[Decision]:
        """更新决策 - 自动检测变更并记录 changelog"""
        change_reason = data.pop("change_reason", "")

        decision = self.db.query(Decision).filter(Decision.id == decision_id).first()
        if not decision:
            return None

        # 检测变更并记录 changelog
        tracked_fields = {
            "title": "标题",
            "description": "描述",
            "context": "背景",
            "chosen_option": "最终选择",
            "rationale": "决策理由",
            "status": "状态",
            "confidence_score": "信心评分",
            "review_interval_days": "复盘周期",
        }

        for key, display_name in tracked_fields.items():
            if key in data:
                old_val = getattr(decision, key)
                new_val = data[key]
                if str(old_val) != str(new_val):
                    log = DecisionChangeLog(
                        decision_id=decision_id,
                        field_name=display_name,
                        old_value=str(old_val) if old_val else "",
                        new_value=str(new_val) if new_val else "",
                        change_reason=change_reason,
                    )
                    self.db.add(log)

        # 跟踪 JSON 字段：options
        if "options" in data:
            old_opts = json.dumps(decision.options, ensure_ascii=False) if decision.options else ""
            new_opts = json.dumps(data["options"], ensure_ascii=False)
            if old_opts != new_opts:
                log = DecisionChangeLog(
                    decision_id=decision_id,
                    field_name="选项",
                    old_value=old_opts[:500],
                    new_value=new_opts[:500],
                    change_reason=change_reason,
                )
                self.db.add(log)

        # 状态机校验
        if "status" in data and data["status"] != decision.status:
            current = decision.status
            requested = data["status"]
            allowed = STATUS_TRANSITIONS.get(current, [])
            if requested not in allowed:
                raise ValueError(
                    f"无效的状态变更: {current} → {requested}。"
                    f"允许的变更: {' → '.join(allowed) if allowed else '无'}"
                )

        for key, value in data.items():
            if hasattr(decision, key):
                setattr(decision, key, value)

        # 如果状态变更为 active，记录决策时间
        if data.get("status") == "active" and not decision.decided_at:
            decision.decided_at = beijing_now()

        # 更新复盘日期
        if data.get("review_interval_days"):
            decision.next_review_date = beijing_now() + timedelta(
                days=data["review_interval_days"]
            )

        decision.updated_at = beijing_now()
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def add_review(self, decision_id: int, data: dict) -> Optional[DecisionReview]:
        """添加复盘记录"""
        decision = self.db.query(Decision).filter(Decision.id == decision_id).first()
        if not decision:
            return None

        review = DecisionReview(
            decision_id=decision_id,
            **{k: v for k, v in data.items() if hasattr(DecisionReview, k) and k != 'decision_id'}
        )
        self.db.add(review)

        # 更新决策的复盘信息
        decision.last_reviewed_at = beijing_now()
        decision.next_review_date = beijing_now() + timedelta(
            days=decision.review_interval_days
        )
        decision.updated_at = beijing_now()

        # 如果是进展更新而非最终结论，保持决策 active 状态
        if not data.get("is_progress_update"):
            # 只有非进展更新时才可能有状态变化，但保持 active 不变
            pass

        self.db.commit()
        self.db.refresh(review)
        return review

    def get_due_reviews(self) -> list[Decision]:
        """获取到期的复盘任务 — 包括 active 进行中决策"""
        now = beijing_now()
        return (
            self.db.query(Decision)
            .filter(
                Decision.status == "active",
                Decision.next_review_date <= now,
            )
            .order_by(Decision.next_review_date.asc())
            .all()
        )

    def get_review_history(self, decision_id: int) -> list[DecisionReview]:
        """获取决策的复盘历史"""
        return (
            self.db.query(DecisionReview)
            .filter(DecisionReview.decision_id == decision_id)
            .order_by(DecisionReview.review_date.desc())
            .all()
        )

    def get_change_log(self, decision_id: int) -> list[DecisionChangeLog]:
        """获取决策的变更历史"""
        return (
            self.db.query(DecisionChangeLog)
            .filter(DecisionChangeLog.decision_id == decision_id)
            .order_by(DecisionChangeLog.changed_at.desc())
            .all()
        )

    def get_decisions_overview(self) -> dict:
        """获取决策概览统计数据"""
        total = self.db.query(Decision).count()
        active = self.db.query(Decision).filter(Decision.status == "active").count()
        completed = self.db.query(Decision).filter(Decision.status == "completed").count()
        due_reviews = len(self.get_due_reviews())

        return {
            "total": total,
            "active": active,
            "completed": completed,
            "abandoned": self.db.query(Decision).filter(Decision.status == "abandoned").count(),
            "due_reviews": due_reviews,
        }
