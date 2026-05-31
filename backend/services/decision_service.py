"""决策复盘服务 - 决策管理和复盘分析"""

import json
from datetime import timedelta
from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.models import AppUser, Decision, DecisionReview, DecisionChangeLog
from utils import beijing_now


STATUS_TRANSITIONS = {
    "draft": ["active"],
    "active": ["completed", "abandoned"],
    "completed": ["active"],
    "abandoned": ["active"],
}


class DecisionService:
    """决策管理服务"""

    def __init__(self, db: Session, current_user: AppUser):
        self.db = db
        self.current_user = current_user

    def _scoped_decisions(self):
        return self.db.query(Decision).filter(Decision.owner_user_id == self.current_user.id)

    def _get_owned_decision(self, decision_id: int) -> Optional[Decision]:
        return self._scoped_decisions().filter(Decision.id == decision_id).first()

    def _get_next_node_order(self, parent_decision_id: Optional[int]) -> int:
        max_order = self.db.query(func.max(Decision.node_order)).filter(
            Decision.parent_decision_id == parent_decision_id,
            Decision.owner_user_id == self.current_user.id,
        ).scalar()
        return (max_order or 0) + 1

    def _get_descendant_ids(self, decision_id: int) -> set[int]:
        descendant_ids = set()
        stack = [decision_id]
        while stack:
            current_id = stack.pop()
            children = self._scoped_decisions().with_entities(Decision.id).filter(
                Decision.parent_decision_id == current_id
            ).all()
            for (child_id,) in children:
                if child_id not in descendant_ids:
                    descendant_ids.add(child_id)
                    stack.append(child_id)
        return descendant_ids

    def _sync_subtree_root(self, decision_id: int, root_id: int) -> None:
        descendants = self._get_descendant_ids(decision_id)
        if descendants:
            self._scoped_decisions().filter(Decision.id.in_(descendants)).update(
                {Decision.root_decision_id: root_id},
                synchronize_session=False,
            )

    def create_decision(self, data: dict) -> Decision:
        """创建新决策 - 自动保存 original_context 快照"""
        # 分离 environment_snapshot 和 original_context
        snapshot = data.pop("environment_snapshot", {})
        orig_ctx = data.pop("original_context", "") or data.get("context", "")
        data.pop("root_decision_id", None)
        status = data.get("status", "draft")
        if status not in STATUS_TRANSITIONS:
            raise ValueError(f"无效状态: {status}")
        parent_decision = None
        parent_decision_id = data.get("parent_decision_id")
        if parent_decision_id is not None:
            parent_decision = self._scoped_decisions().filter(
                Decision.id == parent_decision_id
            ).first()
            if not parent_decision:
                raise ValueError("父决策不存在")
        if data.get("node_order") is None:
            data["node_order"] = self._get_next_node_order(parent_decision_id)

        decision = Decision(**{k: v for k, v in data.items() if hasattr(Decision, k)})
        decision.owner_user_id = self.current_user.id
        decision.original_context = orig_ctx
        decision.environment_snapshot = snapshot
        decision.next_review_date = beijing_now() + timedelta(
            days=data.get("review_interval_days", 30)
        )
        self.db.add(decision)
        self.db.flush()
        decision.root_decision_id = (
            parent_decision.root_decision_id if parent_decision else decision.id
        )
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def update_decision(self, decision_id: int, data: dict) -> Optional[Decision]:
        """更新决策 - 自动检测变更并记录 changelog"""
        change_reason = data.pop("change_reason", "")

        decision = self._get_owned_decision(decision_id)
        if not decision:
            return None

        # 检测变更并记录 changelog
        tracked_fields = {
            "title": "标题",
            "description": "描述",
            "context": "背景",
            "parent_decision_id": "父决策",
            "node_order": "节点顺序",
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
                        owner_user_id=self.current_user.id,
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
                    owner_user_id=self.current_user.id,
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

        parent_changed = False
        if "parent_decision_id" in data and data["parent_decision_id"] != decision.parent_decision_id:
            parent_changed = True
            new_parent_id = data["parent_decision_id"]
            if new_parent_id == decision.id:
                raise ValueError("父决策不能是自己")

            descendants = self._get_descendant_ids(decision.id)
            if new_parent_id in descendants:
                raise ValueError("不能将决策移动到自己的子节点下")

            if new_parent_id is None:
                data["root_decision_id"] = decision.id
            else:
                new_parent = self._scoped_decisions().filter(Decision.id == new_parent_id).first()
                if not new_parent:
                    raise ValueError("父决策不存在")
                data["root_decision_id"] = new_parent.root_decision_id or new_parent.id

            if "node_order" not in data:
                data["node_order"] = self._get_next_node_order(new_parent_id)

        for key, value in data.items():
            if hasattr(decision, key):
                setattr(decision, key, value)

        # 如果状态变更为 active，记录决策时间
        if data.get("status") == "active" and not decision.decided_at:
            decision.decided_at = beijing_now()

        # 更新复盘日期
        if data.get("review_interval_days") is not None:
            decision.next_review_date = beijing_now() + timedelta(
                days=data["review_interval_days"]
            )

        decision.updated_at = beijing_now()
        if parent_changed:
            self._sync_subtree_root(decision.id, decision.root_decision_id or decision.id)
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def add_review(self, decision_id: int, data: dict) -> Optional[DecisionReview]:
        """添加复盘记录"""
        decision = self._get_owned_decision(decision_id)
        if not decision:
            return None

        review = DecisionReview(
            owner_user_id=self.current_user.id,
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
            self._scoped_decisions()
            .filter(
                Decision.status == "active",
                Decision.next_review_date <= now,
            )
            .order_by(Decision.next_review_date.asc())
            .all()
        )

    def get_review_history(self, decision_id: int) -> list[DecisionReview]:
        """获取决策的复盘历史"""
        if not self._get_owned_decision(decision_id):
            return []
        return self.db.query(DecisionReview).filter(
            DecisionReview.decision_id == decision_id,
            DecisionReview.owner_user_id == self.current_user.id,
        ).order_by(DecisionReview.review_date.desc()).all()

    def get_change_log(self, decision_id: int) -> list[DecisionChangeLog]:
        """获取决策的变更历史"""
        if not self._get_owned_decision(decision_id):
            return []
        return self.db.query(DecisionChangeLog).filter(
            DecisionChangeLog.decision_id == decision_id,
            DecisionChangeLog.owner_user_id == self.current_user.id,
        ).order_by(DecisionChangeLog.changed_at.desc()).all()

    def get_decisions_overview(self) -> dict:
        """获取决策概览统计数据"""
        base_query = self._scoped_decisions()
        total = base_query.count()
        active = base_query.filter(Decision.status == "active").count()
        completed = base_query.filter(Decision.status == "completed").count()
        due_reviews = len(self.get_due_reviews())

        return {
            "total": total,
            "active": active,
            "completed": completed,
            "abandoned": base_query.filter(Decision.status == "abandoned").count(),
            "due_reviews": due_reviews,
        }
