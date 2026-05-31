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
1. 提取 2-8 条核心技能/知识
2. 每条技能必须包含以下字段:
   - name: 简短有力的名称 (中文, 10字以内)
   - category: 分类, 可选值: principle(原则) / method(方法) / lesson(教训) / insight(洞察) / pattern(模式)
   - description: 一句话描述 (50字以内)
   - example: 笔记中支持该技能的具体原文片段 (直接引用, 50字以内)
   - confidence: 置信度 1-5 (该技能在笔记中得到充分论证为5, 仅提及为1)
   - actionability: 可行动性 1-5 (可直接应用到决策中为5, 偏理论为1)
   - tags: 相关标签列表 (2-4个, 如 "投资", "心理", "管理", "学习", "沟通"等)
3. 只提取笔记中确实包含的内容, 不要编造
4. 以 JSON 数组格式返回, 不要包含其他文字

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

    def search_notes(self, query: str, limit: int = 20) -> list[Note]:
        """增强关键词搜索：分词多关键词、标题优先排序、截取上下文摘要"""
        keywords = [kw.strip() for kw in query.split() if kw.strip()]
        if not keywords:
            return []

        from sqlalchemy import or_, case, literal

        # 每个关键词匹配标题或内容
        title_conditions = [Note.title.ilike(f"%{kw}%") for kw in keywords]
        content_conditions = [Note.content.ilike(f"%{kw}%") for kw in keywords]

        title_match = or_(*title_conditions)
        content_match = or_(*content_conditions)

        notes = (
            self.db.query(Note)
            .filter(or_(title_match, content_match))
            .order_by(
                case((title_match, 0), else_=1),
                Note.updated_at.desc(),
            )
            .limit(limit)
            .all()
        )

        # 附上上下文摘要（找到首个匹配关键词位置，取周围文字）
        for note in notes:
            snippet = ""
            if note.content:
                first_pos = len(note.content)
                for kw in keywords:
                    pos = note.content.lower().find(kw.lower())
                    if pos != -1 and pos < first_pos:
                        first_pos = pos
                if first_pos < len(note.content):
                    start = max(0, first_pos - 40)
                    end = min(len(note.content), first_pos + 80)
                    snippet = note.content[start:end]
                    if start > 0:
                        snippet = "..." + snippet
                    if end < len(note.content):
                        snippet = snippet + "..."
            setattr(note, "_snippet", snippet)

        return notes

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
