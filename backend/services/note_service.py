"""笔记服务 - Markdown 笔记管理与 AI Skills 提取"""

import json
import os
from typing import Optional
from sqlalchemy.orm import Session

from models.models import Note, NoteCategory


class NoteService:
    """笔记服务"""

    def __init__(self, db: Session):
        self.db = db
        self.api_key = os.getenv("LLM_API_KEY", "")
        self.api_base = os.getenv("LLM_API_BASE", "https://api.openai.com/v1")
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")

    def extract_skills(self, note_id: int) -> list[dict]:
        """从笔记中提取决策原则、方法论、经验教训"""
        note = self.db.query(Note).filter(Note.id == note_id).first()
        if not note:
            return []

        prompt = f"""你是一位经验提炼专家。请从下面的笔记中提取可复用的决策原则、方法论和/or 经验教训。

要求：
1. 提取 3-7 条核心技能/知识
2. 每条技能包含: name(简短名称), category(分类: principle/method/lesson), description(一句话描述), tags(相关标签列表)
3. 只提取笔记中确实包含的内容，不要编造
4. 以 JSON 数组格式返回

笔记标题: {note.title}
笔记内容:
{note.content[:8000]}
"""

        try:
            import httpx
            response = httpx.post(
                f"{self.api_base}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                },
                timeout=30,
            )
            result = response.json()
            content = result["choices"][0]["message"]["content"]

            # 尝试解析 JSON
            skills = self._parse_skills(content)
            if skills:
                note.ai_skills = skills
                self.db.commit()
            return skills or []
        except Exception:
            return []

    def _parse_skills(self, content: str) -> list[dict]:
        """从 LLM 响应中解析 skills JSON"""
        # 尝试提取 JSON 块
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        try:
            data = json.loads(content)
            if isinstance(data, list):
                return data
            if isinstance(data, dict) and "skills" in data:
                return data["skills"]
            return []
        except json.JSONDecodeError:
            return []

    def search_notes(self, query: str, limit: int = 10) -> list[Note]:
        """基于关键词搜索笔记（简单 LIKE 搜索，后续可升级为语义搜索）"""
        search = f"%{query}%"
        return (
            self.db.query(Note)
            .filter(
                (Note.title.ilike(search)) | (Note.content.ilike(search))
            )
            .order_by(Note.updated_at.desc())
            .limit(limit)
            .all()
        )

    def get_relevant_skills(self, context: str, limit: int = 5) -> list[dict]:
        """根据决策上下文获取相关 skills（关键词匹配）"""
        if not context:
            return []
        keywords = set(context.lower().split())
        all_skills = []
        notes = self.db.query(Note).filter(Note.ai_skills.isnot(None)).all()
        for note in notes:
            if note.ai_skills:
                for skill in note.ai_skills:
                    # 计算关键词匹配度
                    skill_text = f"{skill.get('name', '')} {skill.get('description', '')} {''.join(skill.get('tags', []))}".lower()
                    match_count = sum(1 for kw in keywords if kw in skill_text)
                    if match_count > 0:
                        all_skills.append((match_count, skill))
        all_skills.sort(key=lambda x: x[0], reverse=True)
        return [s[1] for s in all_skills[:limit]]
