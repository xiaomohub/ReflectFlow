"""AI 过滤与决策辅助服务

核心功能：
1. 对原始文章进行智能过滤和排序（结合用户领域上下文）
2. 为决策提供 AI 建议
3. 生成文章摘要和行动建议
"""

import json
import os
from typing import Optional
from sqlalchemy.orm import Session

from models.models import Article, Source, UserContext, Setting
from utils import beijing_now


class AIFilterService:
    """AI 过滤服务 - 连接 LLM 进行智能信息过滤"""

    def __init__(self, db: Session):
        self.db = db
        self.api_key = os.getenv("LLM_API_KEY", "")
        self.api_base = os.getenv("LLM_API_BASE", "https://api.openai.com/v1")
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")

    def _build_user_context_prompt(self) -> str:
        """构建用户上下文提示词"""
        contexts = self.db.query(UserContext).filter(UserContext.is_active == True).all()
        if not contexts:
            return "用户暂未设置关注领域。"

        parts = []
        for ctx in contexts:
            goals_text = "\n    - ".join(ctx.goals) if ctx.goals else "无"
            parts.append(f"""
## 领域: {ctx.domain} (优先级: {ctx.priority}/10)
- 描述: {ctx.description}
- 当前重点: {ctx.current_focus}
- 目标:
    - {goals_text}
""")
        return "\n".join(parts)

    def filter_articles(self, article_ids: Optional[list[int]] = None) -> list[Article]:
        """对文章进行 AI 过滤和评分——仅处理未被过滤过的文章，跳过 skip_filter 信息源"""
        query = self.db.query(Article).filter(Article.filtered_at.is_(None))
        # 排除设置了跳过过滤的信息源
        query = query.outerjoin(Source, Article.source_id == Source.id).filter(
            (Source.skip_filter == False) | (Source.skip_filter.is_(None))
        )
        if article_ids:
            query = query.filter(Article.id.in_(article_ids))
        articles = query.order_by(Article.created_at.desc()).limit(50).all()

        if not articles:
            return []

        user_context = self._build_user_context_prompt()

        # 分批处理，每批最多10篇
        batch_size = 10
        for i in range(0, len(articles), batch_size):
            batch = articles[i:i + batch_size]
            self._analyze_batch(batch, user_context)

        return articles

    def _analyze_batch(self, articles: list[Article], user_context: str):
        """调用 LLM 分析一批文章"""
        if not self.api_key:
            self._fallback_analysis(articles)
            return

        articles_data = []
        for idx, article in enumerate(articles):
            articles_data.append({
                "id": idx,
                "article_db_id": article.id,
                "title": article.title,
                "content_preview": article.content[:1500],
                "source": str(article.source_id),
            })

        prompt = f"""你是一个个人信息助理，帮助用户过滤和排序信息。

## 用户当前的关注领域和目标
{user_context}

## 待分析的文章列表
请对以下每篇文章进行分析，输出 JSON 数组。

{json.dumps(articles_data, ensure_ascii=False, indent=2)}

对每篇文章，返回以下字段：
- "id": 文章ID(数字)
- "relevance_score": 相关度评分(0.0-1.0)，与用户领域越相关分数越高
- "relevance_reason": 相关原因简述(50字以内)，写明匹配到哪个领域/人物/关键词，格式如"关注领域:AI"或"重要人物:马斯克"
- "summary": 一句话摘要(30字以内)
- "suggested_action": 建议操作，"read"(值得阅读)、"archive"(可存档)、"decide"(需要做决策)、"ignore"(忽略)
- "tags": 建议标签(数组)

只返回 JSON 数组，不要其他内容。"""

        try:
            import httpx
            response = httpx.post(
                f"{self.api_base}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                },
                timeout=60,
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]

            # 尝试解析 JSON
            parsed = self._parse_llm_response(content)
            if parsed:
                for item in parsed:
                    article_id = item.get("article_db_id") or item.get("id")
                    article = next(
                        (a for a in articles if a.id == article_id),
                        None
                    )
                    if article:
                        article.relevance_score = item.get("relevance_score", 0)
                        article.relevance_reason = item.get("relevance_reason", "")
                        article.summary = item.get("summary", "")
                        article.suggested_action = item.get("suggested_action", "read")

                        # 提取匹配的关注领域
                        domains = self.db.query(UserContext).filter(UserContext.is_active == True).all()
                        matched_domains = []
                        reason_lower = article.relevance_reason.lower()
                        for d in domains:
                            if d.domain.lower() in reason_lower:
                                matched_domains.append(d.domain)

                        article.ai_analysis = {
                            "tags": item.get("tags", []),
                            "raw_analysis": item,
                            "matched_domains": matched_domains,
                        }
                        article.filtered_at = beijing_now()

                self.db.commit()

                # 删除相关度为0的文章 + 重要人物提权 + 敏感过滤
                self._post_process_batch(articles)
        except Exception as e:
            print(f"LLM 调用失败: {e}")
            self._fallback_analysis(articles)

    def _fallback_analysis(self, articles: list[Article]):
        """当 LLM 不可用时的简单关键词匹配"""
        contexts = self.db.query(UserContext).filter(UserContext.is_active == True).all()
        keywords = set()
        for ctx in contexts:
            for word in ctx.current_focus.split():
                if len(word) > 1:
                    keywords.add(word.lower())
            for goal in ctx.goals:
                for word in goal.split():
                    if len(word) > 1:
                        keywords.add(word.lower())

        for article in articles:
            text = f"{article.title} {article.content}".lower()
            matched_kws = [kw for kw in keywords if kw in text]
            matches = len(matched_kws)
            score = min(1.0, matches / max(len(keywords), 1) * 3)
            article.relevance_score = round(score, 2)
            article.relevance_reason = (
                f"匹配关键词: {', '.join(matched_kws[:5])}" if matches > 0
                else "无关键词匹配"
            )
            article.summary = article.title[:100]
            article.suggested_action = "read" if score > 0.3 else "archive"
            # 提取匹配的关注领域
            domains = self.db.query(UserContext).filter(UserContext.is_active == True).all()
            matched_domains = []
            for d in domains:
                d_lower = d.domain.lower()
                if any(d_lower in kw.lower() for kw in matched_kws):
                    matched_domains.append(d.domain)

            article.ai_analysis = {
                "matched_keywords": matched_kws,
                "all_keywords": list(keywords),
                "matched_domains": matched_domains,
                "method": "fallback",
            }
            article.filtered_at = beijing_now()

        self.db.commit()
        self._post_process_batch(articles)

    def _post_process_batch(self, articles: list[Article]):
        """后处理：敏感内容过滤、零相关度删除、重要人物提权"""
        # 加载配置
        figures_setting = self.db.query(Setting).filter(Setting.key == "important_figures").first()
        sensitive_setting = self.db.query(Setting).filter(Setting.key == "sensitive_words").first()

        important_figures = []
        if figures_setting and figures_setting.value:
            important_figures = [f.strip().lower() for f in figures_setting.value.split(",") if f.strip()]

        sensitive_words = []
        if sensitive_setting and sensitive_setting.value:
            sensitive_words = [w.strip().lower() for w in sensitive_setting.value.split(",") if w.strip()]

        for article in articles:
            text = f"{article.title} {article.content}".lower()
            deleted = False

            # 1. 敏感内容过滤（优先检查，命中直接删除）
            if sensitive_words:
                for word in sensitive_words:
                    if word in text:
                        print(f"[filter] 敏感内容过滤: 删除文章 #{article.id} '{article.title}' (命中: {word})")
                        self.db.delete(article)
                        deleted = True
                        break

            if not deleted:
                # 2. 零相关度删除
                if article.relevance_score == 0:
                    print(f"[filter] 零相关度: 删除文章 #{article.id} '{article.title}'")
                    self.db.delete(article)
                    deleted = True

                # 3. 重要人物提权（仅对未删除的文章）
                if not deleted and important_figures:
                    for figure in important_figures:
                        if figure in text:
                            old_score = article.relevance_score
                            article.relevance_score = min(1.0, article.relevance_score + 0.2)
                            article.relevance_reason += f" [重要人物提及]"
                            if old_score != article.relevance_score:
                                print(f"[filter] 重要人物提权: #{article.id} 评分 {old_score}→{article.relevance_score}")
                            break

            self.db.commit()

    def _parse_llm_response(self, content: str) -> list:
        """解析 LLM 的 JSON 响应"""
        # 尝试提取 JSON
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
            content = content.rsplit("```", 1)[0]
        content = content.strip()

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # 尝试找到 JSON 数组
        try:
            start = content.find("[")
            end = content.rfind("]") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
        except (json.JSONDecodeError, ValueError):
            pass

        return []

    def get_decision_advice(self, title: str, context: str,
                            options: list[dict], related_domains: list[str]) -> dict:
        """获取 AI 决策建议"""
        if not self.api_key:
            return {
                "advice": "AI 决策建议功能需要配置 LLM_API_KEY。建议根据直觉做决策，并设定复盘周期。",
                "recommended_option": None,
                "analysis": "LLM 未配置"
            }

        options_text = "\n".join(
            f"- {opt.get('name', '选项')}: 优点: {', '.join(opt.get('pros', []))} | "
            f"缺点: {', '.join(opt.get('cons', []))} | 自评分: {opt.get('score', 5)}"
            for opt in options
        )

        prompt = f"""你是一个决策顾问。请帮助用户分析以下决策。

## 决策标题
{title}

## 背景
{context}

## 关联领域
{', '.join(related_domains)}

## 考虑选项
{options_text if options_text else "暂无选项"}

请从以下角度分析：
1. 各选项的优劣比较
2. 结合用户关注领域的建议
3. 风险提示
4. 推荐选项及理由

返回 JSON 格式：
{{
    "analysis": "详细分析...",
    "recommended_option": "推荐选项名称",
    "advice": "一段精炼的建议..."
}}
只返回 JSON。"""

        try:
            import httpx
            response = httpx.post(
                f"{self.api_base}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.5,
                },
                timeout=60,
            )
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            return self._parse_llm_response(content) or {
                "analysis": content, "advice": content, "recommended_option": None
            }
        except Exception as e:
            return {
                "advice": f"AI 分析失败: {e}",
                "recommended_option": None,
                "analysis": str(e)
            }
