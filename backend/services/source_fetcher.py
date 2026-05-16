"""信息源获取服务 - 从 RSS/网页/API 等来源拉取信息"""

import hashlib
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from models.models import Source, Article


class SourceFetcher:
    """信息源获取器"""

    def __init__(self, db: Session):
        self.db = db

    def fetch_source(self, source_id: int) -> list[Article]:
        """获取单个信息源的内容"""
        source = self.db.query(Source).filter(Source.id == source_id).first()
        if not source or not source.enabled:
            return []

        # 频率限制：5 分钟内不重复抓取
        if source.last_fetched_at:
            from datetime import timedelta
            if datetime.now(timezone.utc) - source.last_fetched_at < timedelta(minutes=5):
                print(f"信息源 {source.name} 在 5 分钟内刚抓取过，跳过")
                return []

        articles = []
        try:
            if source.source_type == "rss":
                articles = self._fetch_rss(source)
            elif source.source_type == "webpage":
                articles = self._fetch_webpage(source)
            elif source.source_type == "api":
                articles = self._fetch_api(source)
            elif source.source_type == "xueqiu":
                articles = self._fetch_xueqiu(source)

            # 更新拉取时间
            source.last_fetched_at = datetime.now(timezone.utc)
            self.db.commit()
        except Exception as e:
            print(f"获取信息源 {source.name} 失败: {e}")

        return articles

    def fetch_all_sources(self) -> list[Article]:
        """获取所有启用的信息源"""
        sources = self.db.query(Source).filter(Source.enabled == True).all()
        all_articles = []
        for source in sources:
            all_articles.extend(self.fetch_source(source.id))
        return all_articles

    def _fetch_rss(self, source: Source) -> list[Article]:
        """从 RSS 源获取文章"""
        try:
            import feedparser
            feed = feedparser.parse(source.url)
            articles = []
            for entry in feed.entries[:50]:  # 最多取50条
                title = entry.get("title", "")
                link = entry.get("link", "")
                content = entry.get("summary", entry.get("description", ""))

                # 去重检查
                content_hash = hashlib.md5(f"{title}{link}".encode()).hexdigest()
                existing = self.db.query(Article).filter(
                    Article.title == title, Article.source_id == source.id
                ).first()
                if existing:
                    continue

                article = Article(
                    source_id=source.id,
                    title=title,
                    url=link,
                    content=content,
                    author=entry.get("author", ""),
                    status="new",
                )
                self.db.add(article)
                articles.append(article)

            self.db.commit()
            return articles
        except ImportError:
            print("需要安装 feedparser: pip install feedparser")
            return []
        except Exception as e:
            print(f"RSS 解析失败: {e}")
            return []

    def _fetch_webpage(self, source: Source) -> list[Article]:
        """从网页源获取内容（简易抓取）"""
        try:
            import requests
            from bs4 import BeautifulSoup
            resp = requests.get(source.url, timeout=30, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            resp.encoding = resp.apparent_encoding
            soup = BeautifulSoup(resp.text, "html.parser")

            # 移除无用标签
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()

            text = soup.get_text(separator="\n", strip=True)
            text = "\n".join(line for line in text.split("\n") if len(line) > 20)

            title = soup.title.string if soup.title else source.name

            return self._save_article(source, title, source.url, text[:10000])
        except Exception as e:
            print(f"网页抓取失败: {e}")
            return []

    def _fetch_api(self, source: Source) -> list[Article]:
        """从 API 源获取（预留扩展）"""
        # 可根据具体 API 格式扩展
        print(f"API 类型信息源 '{source.name}' 需要自定义适配器")
        return []

    def _fetch_xueqiu(self, source: Source) -> list[Article]:
        """从雪球用户时间线抓取内容"""
        try:
            import re
            import json
            import requests as req

            # 从 URL 提取 user_id：https://xueqiu.com/{user_id}
            match = re.search(r'xueqiu\.com/(\d+)', source.url)
            if not match:
                print(f"雪球 URL 格式错误: {source.url}，应为 https://xueqiu.com/{user_id}")
                return []

            user_id = match.group(1)

            # 从 source.config 获取 Cookie
            config = source.config or {}
            cookies_str = config.get("cookies", "")

            # 构建请求头
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Referer": f"https://xueqiu.com/u/{user_id}",
                "Origin": "https://xueqiu.com",
            }

            # 解析 Cookie 字符串为字典
            cookie_dict = {}
            if cookies_str:
                for item in cookies_str.split(";"):
                    item = item.strip()
                    if "=" in item:
                        k, v = item.split("=", 1)
                        cookie_dict[k.strip()] = v.strip()

            session = req.Session()
            session.headers.update(headers)

            # 先访问首页获取临时 Cookie
            session.get("https://xueqiu.com/", timeout=15)

            # 如果有用户提供的 Cookie，设置到 session
            for k, v in cookie_dict.items():
                session.cookies.set(k, v)

            # 调用雪球用户时间线 API
            api_url = f"https://xueqiu.com/statuses/original/timeline.json?user_id={user_id}&page=1"
            resp = session.get(api_url, timeout=15)
            if resp.status_code != 200:
                print(f"雪球 API 请求失败，状态码: {resp.status_code}，可能需要更新 Cookie")
                return []

            data = resp.json()
            statuses = data.get("statuses", [])

            if not statuses:
                print(f"雪球用户 {user_id} 暂无新内容")
                return []

            articles = []
            for status in statuses[:30]:  # 最多取 30 条
                title = status.get("title", "") or status.get("text", "")[:60]
                text = status.get("text", "")
                # 去重
                existing = self.db.query(Article).filter(
                    Article.title == title[:200],
                    Article.source_id == source.id,
                ).first()
                if existing:
                    continue

                # 解析发布时间
                created_at_str = status.get("created_at", "")
                try:
                    article_date = datetime.strptime(created_at_str, "%a %b %d %H:%M:%S %z %Y")
                except (ValueError, TypeError):
                    article_date = datetime.now(timezone.utc)

                article = Article(
                    source_id=source.id,
                    title=title[:500],
                    url=f"https://xueqiu.com/{user_id}/{status.get('id', '')}",
                    content=text if text else title,
                    author=status.get("user", {}).get("screen_name", "雪球用户"),
                    status="new",
                    created_at=article_date,
                )
                self.db.add(article)
                articles.append(article)

            self.db.commit()
            print(f"从雪球用户 {user_id} 抓取了 {len(articles)} 条新内容")
            return articles

        except ImportError:
            print("需要安装 requests: pip install requests")
            return []
        except Exception as e:
            print(f"雪球抓取失败: {e}")
            return []

    def _save_article(self, source: Source, title: str, url: str, content: str) -> list[Article]:
        existing = self.db.query(Article).filter(
            Article.title == title, Article.source_id == source.id
        ).first()
        if existing:
            return []

        article = Article(
            source_id=source.id,
            title=title[:500],
            url=url[:500],
            content=content,
            status="new",
        )
        self.db.add(article)
        self.db.commit()
        return [article]
