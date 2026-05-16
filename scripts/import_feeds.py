"""从 OPML 精选 RSS 源导入数据库"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import xml.etree.ElementTree as ET
from sqlalchemy.orm import Session
from models.database import engine, SessionLocal, init_db
from models.models import Source

# 精选源列表（按标题匹配）
SELECTED_TITLES = {
    # 技术核心：Java/Python/DevOps/DBA
    "AWS Architecture Blog",
    "ByteByteGo Newsletter",
    "The Cloudflare Blog",
    "Docker",
    "Elastic Blog",
    "The GitHub Blog",
    "Spring Blog",
    "Stack Overflow Blog",
    "The JetBrains Blog",
    "The IntelliJ IDEA Blog",
    "Thoughtworks洞见",
    "京东技术",
    "vivo互联网技术",
    "51CTO技术栈",
    "Datawhale",
    "dbaplus社群",
    # AI/ML
    "deeplearning.ai",
    "DeepSeek",
    "AI前线",
    "Apple Machine Learning Research",
    # 投资/商业
    "36氪",
    "a16z(@a16z)",
    "Y Combinator(@ycombinator)",
    "SaaS白夜行",
    # 泛文化
    "Simon Willison's Weblog",
    "乱翻书",
    "三五环",
    "人民公园说AI",
    "产品二姐",
}

# 标题替换（OPML 标题 -> 更干净的名字）
TITLE_OVERRIDES = {
    "a16z(@a16z)": "a16z",
    "Y Combinator(@ycombinator)": "Y Combinator",
    "The Cloudflare Blog": "Cloudflare Blog",
    "The GitHub Blog": "GitHub Blog",
    "The JetBrains Blog": "JetBrains Blog",
    "The IntelliJ IDEA Blog": "IntelliJ IDEA Blog",
    "Simon Willison's Weblog": "Simon Willison",
}


def parse_opml(path: str) -> list[dict]:
    """解析 OPML 文件，返回所有 RSS 源"""
    tree = ET.parse(path)
    root = tree.getroot()
    body = root.find('.//body')
    feeds = []

    for outline in body.findall('.//outline'):
        xml_url = outline.get('xmlUrl')
        title = outline.get('title', '')
        html_url = outline.get('htmlUrl', '')
        if xml_url and title:
            feeds.append({
                'title': title,
                'xml_url': xml_url,
                'html_url': html_url,
            })

    return feeds


def import_feeds(db: Session, feeds: list[dict], selected: set[str]):
    """导入匹配的源到数据库"""
    imported = 0
    skipped = 0
    not_found = set(selected)

    for feed in feeds:
        title = feed['title']
        if title not in selected:
            continue

        not_found.discard(title)
        name = TITLE_OVERRIDES.get(title, title)

        existing = db.query(Source).filter(Source.name == name).first()
        if existing:
            print(f"  已跳过（已存在）: {name}")
            skipped += 1
            continue

        source = Source(
            name=name,
            source_type="rss",
            url=feed['xml_url'],
            description="来自 OPML 导入",
            enabled=True,
            fetch_interval=3600,
            tags=[],
            config={},
        )
        db.add(source)
        db.commit()
        print(f"  已添加: {name}")
        imported += 1

    print(f"\n导入完成：新增 {imported}，已存在跳过 {skipped}")
    if not_found:
        print(f"未在 OPML 中找到的源: {', '.join(sorted(not_found))}")

    return imported


if __name__ == '__main__':
    opml_path = os.path.join(os.path.dirname(__file__), '..', 'feeds.opml')

    if not os.path.exists(opml_path):
        print(f"未找到 OPML 文件: {opml_path}")
        sys.exit(1)

    print("正在解析 OPML 文件...")
    feeds = parse_opml(opml_path)
    print(f"  共找到 {len(feeds)} 个 RSS 源")

    matched = [f for f in feeds if f['title'] in SELECTED_TITLES]
    print(f"  匹配到 {len(matched)} 个精选源\n")

    print("正在导入数据库...")
    init_db()
    db = SessionLocal()
    try:
        import_feeds(db, feeds, SELECTED_TITLES)
    finally:
        db.close()
