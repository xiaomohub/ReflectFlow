"""导入关注领域到数据库"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from models.database import SessionLocal, init_db
from models.models import UserContext

CONTEXTS = [
    {
        "domain": "有色金属 / 大宗商品",
        "description": "关注黄金、铜、有色金属等大宗商品的行情与供需分析",
        "current_focus": "黄金与铜的长期价格趋势，有色金属供需格局变化",
        "goals": ["把握有色金属周期性机会", "跟踪全球矿业巨头动态"],
        "priority": 10,
        "is_active": True,
    },
    {
        "domain": "A股价值投资",
        "description": "A股市场价值投资，重点关注化工与矿业龙头",
        "current_focus": "万华化学、紫金矿业、洛阳钼业、盐湖股份的基本面跟踪",
        "goals": ["建立稳定的价值投资组合", "跟踪持仓企业财报与行业动态"],
        "priority": 9,
        "is_active": True,
    },
    {
        "domain": "AI 前沿技术",
        "description": "跟踪 AI 领域最前沿的发展，包括大模型、AI 应用落地",
        "current_focus": "LLM 最新进展、AI 工程化与落地实践、AI 行业影响",
        "goals": ["保持对 AI 技术趋势的敏感度", "将 AI 应用到实际工作中"],
        "priority": 8,
        "is_active": True,
    },
    {
        "domain": "国际政经",
        "description": "关注全球政治经济大事，理解宏观环境变化",
        "current_focus": "中美关系、全球经济与货币政策、地缘政治风险",
        "goals": ["从宏观视角理解投资环境", "预判国际事件对市场的影响"],
        "priority": 7,
        "is_active": True,
    },
    {
        "domain": "DBA & AIOps 运维",
        "description": "数据库运维、智能运维（AIOps）、运维开发技术",
        "current_focus": "数据库技术演进（MySQL、PostgreSQL 等）、AIOps 实践、运维自动化",
        "goals": ["提升数据库运维能力", "探索 AI 在运维领域的应用"],
        "priority": 8,
        "is_active": True,
    },
]

if __name__ == '__main__':
    init_db()
    db = SessionLocal()
    try:
        imported = 0
        for data in CONTEXTS:
            # 检查是否已存在同名领域
            existing = db.query(UserContext).filter(
                UserContext.domain == data["domain"]
            ).first()
            if existing:
                print(f"已跳过（已存在）: {data['domain']}")
                continue

            ctx = UserContext(**data)
            db.add(ctx)
            db.commit()
            print(f"已添加: {data['domain']}")
            imported += 1

        print(f"\n导入完成：新增 {imported} 个关注领域")
    finally:
        db.close()
