"""人格 Skills 服务 — 多视角决策分析

为决策提供多位大师级人物的分析视角：
- 巴菲特：价值投资、长期主义、护城河
- 芒格：多元思维模型、逆向思维、心理误判
- 达利欧：系统化决策、原则驱动、风险平价
- 蒂尔：从0到1、垄断思维、大胆预测
- 塔勒布：反脆弱、黑天鹅、杠铃策略
"""

import json
import os
from typing import Optional
from sqlalchemy.orm import Session

from models.models import Decision


# ===== 人格定义 =====
PERSONAS = [
    {
        "id": "buffett",
        "name": "沃伦·巴菲特",
        "english_name": "Warren Buffett",
        "emoji": "🦸",
        "style": "价值投资 · 长期主义",
        "description": "以长期价值投资闻名，重视企业的护城河、管理层质量和可持续竞争优势。",
        "thinking_style": "你像沃伦·巴菲特一样思考。你注重长期价值、复利效应和确定性。你会分析决策的\"护城河\"——是什么让这个选择在长期内保持优势。你关注管理层(执行者)质量，厌恶复杂难懂的商业模式。你宁可错过也不愿亏损。你的名言是\"规则一：永远不要亏钱。规则二：永远不要忘记规则一。\"",
        "color": "bg-green-50 text-green-700 border-green-200",
        "icon_bg": "bg-green-100",
    },
    {
        "id": "munger",
        "name": "查理·芒格",
        "english_name": "Charlie Munger",
        "emoji": "🧠",
        "style": "多元思维模型 · 逆向思维",
        "description": "普世智慧倡导者，善于运用跨学科思维模型分析问题，擅长逆向思维——`如果知道会死在哪里，就不去那里`。",
        "thinking_style": "你像查理·芒格一样思考。你调用心理学、物理学、生物学、历史学等多学科模型来分析这个决策。你特别关注心理误判倾向——激励偏见、确认偏误、社会认同等。你用逆向思维：先想如何让这个决策失败，然后避免这些因素。你追求\"lollapalooza效应\"——多个因素合力产生的放大效果。",
        "color": "bg-orange-50 text-orange-700 border-orange-200",
        "icon_bg": "bg-orange-100",
    },
    {
        "id": "dalio",
        "name": "瑞·达利欧",
        "english_name": "Ray Dalio",
        "emoji": "📊",
        "style": "系统化决策 · 原则驱动",
        "description": "桥水基金创始人，主张将决策系统化、流程化，用原则指导行动，从错误中学习。",
        "thinking_style": "你像瑞·达利欧一样思考。你相信\"系统化决策优于直觉\"。你会把这个决策分解为可量化、可跟踪的要素。你关注风险平价——每个选项的风险是否与潜在回报匹配。你强调\"痛苦+反思=进步\"，看重决策的可追溯性和可复盘性。你会问：如果把同样的决策做100次，期望值是多少？这背后的原则是什么？",
        "color": "bg-blue-50 text-blue-700 border-blue-200",
        "icon_bg": "bg-blue-100",
    },
    {
        "id": "thiel",
        "name": "彼得·蒂尔",
        "english_name": "Peter Thiel",
        "emoji": "🚀",
        "style": "从0到1 · 垄断思维",
        "description": "PayPal/Palantir 联合创始人，主张从0到1的创新，追求垄断优势而非红海竞争。",
        "thinking_style": "你像彼得·蒂尔一样思考。你关心的是：这个决策是追求\"从0到1\"还是\"从1到n\"？你寻找不对称机会——下行有限、上行无限的选项。你问自己：\"这个选择在10年后还有价值吗？\"你警惕竞争思维陷阱，关注独特性和垄断优势。你不相信\"市场均衡\"，你认为最好的决策往往反共识。你的核心问题是：\"有哪些重要的事，是你和别人看法不同的？\"",
        "color": "bg-purple-50 text-purple-700 border-purple-200",
        "icon_bg": "bg-purple-100",
    },
    {
        "id": "taleb",
        "name": "纳西姆·塔勒布",
        "english_name": "Nassim Taleb",
        "emoji": "🦢",
        "style": "反脆弱 · 黑天鹅",
        "description": "《黑天鹅》《反脆弱》作者，专注于尾部风险、不确定性和如何在混乱中受益。",
        "thinking_style": "你像纳西姆·塔勒布一样思考。你极度关注尾部风险和未知的未知。你分析每个选项的\"凸性\"——即它在极端情况下的表现。你区分\"脆弱\"(害怕波动)、\"强韧\"(无视波动)和\"反脆弱\"(从波动中受益)。你厌恶那些有\"爆仓风险\"的选项，即使概率很小。你推崇杠铃策略——同时持有极度保守和极度激进的仓位，放弃中间地带。你喜欢\"冗余\"和\"过度准备\"。",
        "color": "bg-rose-50 text-rose-700 border-rose-200",
        "icon_bg": "bg-rose-100",
    },
]


class SkillsService:
    """多视角人格分析服务"""

    def __init__(self, db: Session):
        self.db = db
        self.api_key = os.getenv("LLM_API_KEY", "")
        self.api_base = os.getenv("LLM_API_BASE", "https://api.openai.com/v1")
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")

    def analyze_from_personas(self, decision_id: int, persona_ids: Optional[list[str]] = None) -> list[dict]:
        """对指定决策进行多视角分析"""
        decision = self.db.query(Decision).filter(Decision.id == decision_id).first()
        if not decision:
            return []

        selected = [p for p in PERSONAS if persona_ids is None or p["id"] in persona_ids]
        if not selected:
            selected = PERSONAS

        # 构建决策上下文
        decision_context = self._build_decision_context(decision)

        results = []
        for persona in selected:
            analysis = self._call_llm_for_persona(persona, decision_context)
            results.append({
                "persona_id": persona["id"],
                "persona_name": persona["name"],
                "persona_style": persona["style"],
                "emoji": persona["emoji"],
                "analysis": analysis.get("analysis", ""),
                "advice": analysis.get("advice", ""),
                "confidence": analysis.get("confidence", 5),
                "key_questions": analysis.get("key_questions", []),
                "risk_warnings": analysis.get("risk_warnings", []),
            })

        return results

    def analyze_direct(self, title: str, context: str,
                       options: list[dict], persona_ids: Optional[list[str]] = None) -> list[dict]:
        """直接分析决策数据（不依赖数据库中的决策记录）"""
        selected = [p for p in PERSONAS if persona_ids is None or p["id"] in persona_ids]
        if not selected:
            selected = PERSONAS

        decision_context = f"""## 决策标题
{title}

## 背景
{context}

## 考虑选项
"""
        if options:
            for opt in options:
                pros = "\n      - ".join(opt.get("pros", []))
                cons = "\n      - ".join(opt.get("cons", []))
                decision_context += f"""
### {opt.get("name", "选项")} (自评: {opt.get("score", 5)}/10)
  优点:
    - {pros if pros else "无"}
  缺点:
    - {cons if cons else "无"}
"""
        else:
            decision_context += "（暂无选项）\n"

        results = []
        for persona in selected:
            analysis = self._call_llm_for_persona(persona, decision_context)
            results.append({
                "persona_id": persona["id"],
                "persona_name": persona["name"],
                "persona_style": persona["style"],
                "emoji": persona["emoji"],
                "analysis": analysis.get("analysis", ""),
                "advice": analysis.get("advice", ""),
                "confidence": analysis.get("confidence", 5),
                "key_questions": analysis.get("key_questions", []),
                "risk_warnings": analysis.get("risk_warnings", []),
            })

        return results

    def _build_decision_context(self, decision: Decision) -> str:
        """构建决策上下文文本"""
        options_text = ""
        if decision.options:
            for opt in decision.options:
                pros = "\n      - ".join(opt.get("pros", []))
                cons = "\n      - ".join(opt.get("cons", []))
                options_text += f"""
### {opt.get("name", "选项")} (自评: {opt.get("score", 5)}/10)
  优点:
    - {pros if pros else "无"}
  缺点:
    - {cons if cons else "无"}
"""
        else:
            options_text += "（暂无选项）\n"

        return f"""## 决策标题
{decision.title}

## 背景
{decision.context or '未提供'}

## 关联领域
{', '.join(decision.related_domains) if decision.related_domains else '无'}

## 考虑选项
{options_text}

## 当前状态
{decision.status}

## 信心评分
{decision.confidence_score}/10"""

    def _call_llm_for_persona(self, persona: dict, decision_context: str) -> dict:
        """调用 LLM 以特定人格视角分析决策"""
        if not self.api_key:
            return self._fallback_analysis(persona, decision_context)

        prompt = f"""你正在扮演一位特定的思想大师，从TA的独特视角分析一个决策。

## 你扮演的人物
{persona["name"]} ({persona["english_name"]})
风格: {persona["style"]}
特点: {persona["description"]}

## 你的思考方式
{persona["thinking_style"]}

## 需要分析的决策
{decision_context}

请以{persona["name"]}的身份和口吻，分析这个决策。注意：
1. 严格用TA的语言风格和思维方式来分析
2. 可以引用TA的经典名言或原则
3. 要一针见血，避免泛泛而谈
4. 给出具体、可操作的建议

返回 JSON 格式（只返回 JSON，不要其他内容）：
{{
    "analysis": "详细分析（300-500字，展现独特思维风格）",
    "advice": "一句精炼的核心建议（20字以内）",
    "confidence": "你对这个决策的信心评分（1-10的整数）",
    "key_questions": ["你应该问自己的3个关键问题"],
    "risk_warnings": ["需要警惕的2-3个风险"]
}}"""

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
                    "temperature": 0.7,  # 稍高温度，让角色扮演更有创意
                },
                timeout=60,
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            parsed = self._parse_json(content)
            if parsed:
                return parsed
            return self._fallback_analysis(persona, decision_context)
        except Exception as e:
            print(f"[SkillsService] LLM 调用失败 ({persona['name']}): {e}")
            return self._fallback_analysis(persona, decision_context)

    def _fallback_analysis(self, persona: dict, decision_context: str) -> dict:
        """LLM 不可用时的默认分析结果"""
        return {
            "analysis": f"以{persona['name']}的视角看，这个决策需要更多信息才能给出深入分析。"
                        f"当前 AI 未配置 API Key，建议补充 LLM_API_KEY 以获取完整分析。\n\n"
                        f"{persona['description']}\n\n"
                        f"参考建议：{persona['style']}视角下，建议你重新审视这个决策的核心假设。",
            "advice": "配置 LLM_API_KEY 获取个性化分析",
            "confidence": 5,
            "key_questions": [
                "这个决策的核心假设是什么？",
                "如果错了会有什么后果？",
                "有没有更好的替代方案？"
            ],
            "risk_warnings": [
                "信息不足时避免重大决策",
                "注意确认偏误的影响"
            ],
        }

    def _parse_json(self, content: str) -> Optional[dict]:
        """解析 LLM 返回的 JSON"""
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
            content = content.rsplit("```", 1)[0]
        content = content.strip()

        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        try:
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
        except (json.JSONDecodeError, ValueError):
            pass

        return None
