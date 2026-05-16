"""个人复盘网站 - FastAPI 后端入口"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.database import init_db
from routers import sources, articles, contexts, decisions


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="个人复盘系统 API",
    description="信息过滤 -> 决策管理 -> 复盘回顾",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置（允许前端开发服务器访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(sources.router)
app.include_router(articles.router)
app.include_router(contexts.router)
app.include_router(decisions.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "个人复盘系统运行中"}
