"""数据库配置和连接管理"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./review.db"

engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI 依赖注入：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库表"""
    import models.models  # noqa: F401 - 确保模型被注册
    Base.metadata.create_all(bind=engine)

    # 迁移：为已有数据库补充新增的列
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        columns = [c["name"] for c in inspector.get_columns("sources")]
        if "config" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE sources ADD COLUMN config TEXT DEFAULT '{}'"))
                conn.commit()
    except Exception:
        pass  # 表可能还不存在，忽略
