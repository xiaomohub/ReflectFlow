"""决策复盘服务 - 决策管理和复盘分析"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from models.models import Decision, DecisionReview


class DecisionService:
    """决策管理服务"""

    def __init__(self, db: Session):
        self.db = db

    def create_decision(self, data: dict) -> Decision:
        """创建新决策"""
        decision = Decision(**{k: v for k, v in data.items() if hasattr(Decision, k)})
        decision.next_review_date = datetime.now(timezone.utc) + timedelta(
            days=data.get("review_interval_days", 30)
        )
        self.db.add(decision)
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def update_decision(self, decision_id: int, data: dict) -> Optional[Decision]:
        """更新决策"""
        decision = self.db.query(Decision).filter(Decision.id == decision_id).first()
        if not decision:
            return None

        for key, value in data.items():
            if hasattr(decision, key):
                setattr(decision, key, value)

        # 如果状态变更为 active，记录决策时间
        if data.get("status") == "active" and not decision.decided_at:
            decision.decided_at = datetime.now(timezone.utc)

        # 更新复盘日期
        if data.get("review_interval_days"):
            decision.next_review_date = datetime.now(timezone.utc) + timedelta(
                days=data["review_interval_days"]
            )

        decision.updated_at = datetime.now(timezone.utc)
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
        decision.last_reviewed_at = datetime.now(timezone.utc)
        decision.next_review_date = datetime.now(timezone.utc) + timedelta(
            days=decision.review_interval_days
        )
        decision.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(review)
        return review

    def get_due_reviews(self) -> list[Decision]:
        """获取到期的复盘任务"""
        now = datetime.now(timezone.utc)
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
