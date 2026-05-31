"""个人复盘网站 - FastAPI 后端入口"""

import os
import threading
from dotenv import load_dotenv

# 加载 .env 文件（必须在其他模块导入前加载，以便 os.getenv 能读到）
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from models.database import init_db, SessionLocal
from models.models import Setting
from routers import sources, articles, contexts, decisions, settings, notes, skills, source_categories, users
from utils import beijing_now


# ===== 后台定时拉取 =====
_scheduler_stop = threading.Event()


def _auto_fetch_loop():
    """后台线程：每 10 分钟检查是否需要自动拉取"""
    while not _scheduler_stop.is_set():
        try:
            db: Session = SessionLocal()
            try:
                enabled_setting = db.query(Setting).filter(
                    Setting.key == "auto_fetch_enabled"
                ).first()
                if enabled_setting and enabled_setting.value == "true":
                    interval_setting = db.query(Setting).filter(
                        Setting.key == "auto_fetch_interval_hours"
                    ).first()
                    interval_hours = int(interval_setting.value) if interval_setting else 12

                    # 检查所有启用的源，距上次拉取超过间隔的才拉取
                    from models.models import Source
                    from services.source_fetcher import SourceFetcher

                    sources = db.query(Source).filter(Source.enabled == True).all()
                    now = beijing_now()
                    fetcher = SourceFetcher(db)
                    fetched = 0
                    for src in sources:
                        if _scheduler_stop.is_set():
                            break
                        if src.last_fetched_at is None:
                            continue  # skip sources never fetched
                        elapsed = (now - src.last_fetched_at).total_seconds()
                        if elapsed >= interval_hours * 3600:
                            try:
                                n = fetcher.fetch_source(src.id)
                                fetched += len(n) if n else 0
                            except Exception:
                                pass  # individual source failure is non-fatal

                    if fetched > 0:
                        print(f"[scheduler] 自动拉取完成: {fetched} 篇新文章")
            finally:
                db.close()
        except Exception as e:
            print(f"[scheduler] 检查时出错: {e}")

        # 每 10 分钟检查一次
        _scheduler_stop.wait(600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # 启动后台拉取线程
    thread = threading.Thread(target=_auto_fetch_loop, daemon=True)
    thread.start()
    yield
    _scheduler_stop.set()


app = FastAPI(
    title="个人复盘系统 API",
    description="信息过滤 -> 决策管理 -> 复盘回顾",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置（允许前端开发服务器访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:5175", "http://127.0.0.1:5175", "http://localhost:8001", "http://127.0.0.1:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(sources.router)
app.include_router(articles.router)
app.include_router(contexts.router)
app.include_router(decisions.router)
app.include_router(settings.router)
app.include_router(notes.router)
app.include_router(skills.router)
app.include_router(source_categories.router)
app.include_router(users.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "个人复盘系统运行中"}
