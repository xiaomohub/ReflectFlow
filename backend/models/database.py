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

        # 迁移1: sources.config
        src_cols = [c["name"] for c in inspector.get_columns("sources")]
        if "config" not in src_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE sources ADD COLUMN config TEXT DEFAULT '{}'"))
                conn.commit()

        # 迁移2: articles.filtered_at
        art_cols = [c["name"] for c in inspector.get_columns("articles")]
        if "filtered_at" not in art_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE articles ADD COLUMN filtered_at TIMESTAMP"))
                conn.commit()

        # 迁移3: sources.skip_filter
        if "skip_filter" not in src_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE sources ADD COLUMN skip_filter BOOLEAN DEFAULT 0"))
                conn.commit()

        # 迁移4: decisions.environment_snapshot + original_context
        dec_cols = [c["name"] for c in inspector.get_columns("decisions")]
        if "environment_snapshot" not in dec_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decisions ADD COLUMN environment_snapshot TEXT DEFAULT '{}'"))
                conn.commit()
        if "original_context" not in dec_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decisions ADD COLUMN original_context TEXT DEFAULT ''"))
                conn.commit()

        # 迁移5: decision_reviews.progress + adjusted_plan + is_progress_update
        rev_cols = [c["name"] for c in inspector.get_columns("decision_reviews")]
        if "progress" not in rev_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decision_reviews ADD COLUMN progress TEXT DEFAULT ''"))
                conn.commit()
        if "adjusted_plan" not in rev_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decision_reviews ADD COLUMN adjusted_plan TEXT DEFAULT ''"))
                conn.commit()
        if "is_progress_update" not in rev_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decision_reviews ADD COLUMN is_progress_update BOOLEAN DEFAULT 0"))
                conn.commit()

        # 迁移6: decisions.category_id + decision_categories 表
        if "category_id" not in dec_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decisions ADD COLUMN category_id INTEGER REFERENCES decision_categories(id)"))
                conn.commit()

        # 迁移7: sources.category_id + source_categories 表
        if "category_id" not in src_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE sources ADD COLUMN category_id INTEGER REFERENCES source_categories(id)"))
                conn.commit()

        # 迁移8: notes.decision_id
        note_cols = [c["name"] for c in inspector.get_columns("notes")]
        if "decision_id" not in note_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE notes ADD COLUMN decision_id INTEGER REFERENCES decisions(id)"))
                conn.commit()

        # 迁移9: decisions.parent_decision_id (决策树)
        dec_cols = [c["name"] for c in inspector.get_columns("decisions")]
        if "parent_decision_id" not in dec_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decisions ADD COLUMN parent_decision_id INTEGER REFERENCES decisions(id)"))
                conn.commit()

        # 迁移10: decisions.root_decision_id + node_order
        dec_cols = [c["name"] for c in inspector.get_columns("decisions")]
        if "root_decision_id" not in dec_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decisions ADD COLUMN root_decision_id INTEGER REFERENCES decisions(id)"))
                conn.commit()
        if "node_order" not in dec_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE decisions ADD COLUMN node_order INTEGER DEFAULT 0"))
                conn.commit()

        # 回填 root_decision_id，建立历史数据的决策树根引用
        with engine.connect() as conn:
            conn.execute(text("""
                WITH RECURSIVE decision_tree(id, root_id) AS (
                    SELECT id, id
                    FROM decisions
                    WHERE parent_decision_id IS NULL
                    UNION ALL
                    SELECT d.id, dt.root_id
                    FROM decisions d
                    JOIN decision_tree dt ON d.parent_decision_id = dt.id
                )
                UPDATE decisions
                SET root_decision_id = (
                    SELECT dt.root_id
                    FROM decision_tree dt
                    WHERE dt.id = decisions.id
                )
                WHERE root_decision_id IS NULL
            """))
            conn.execute(text("UPDATE decisions SET root_decision_id = id WHERE root_decision_id IS NULL"))
            conn.commit()

        # 迁移11: 新增 app_users 表（权限人员）
        table_names = inspector.get_table_names()
        if "app_users" not in table_names:
            with engine.connect() as conn:
                conn.execute(text("""
                    CREATE TABLE app_users (
                        id INTEGER PRIMARY KEY,
                        username VARCHAR(100) NOT NULL UNIQUE,
                        display_name VARCHAR(200) NOT NULL,
                        role VARCHAR(20) DEFAULT 'normal',
                        is_active BOOLEAN DEFAULT 1,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP
                    )
                """))
                conn.commit()

        # 初始化默认管理员
        with engine.connect() as conn:
            admin_exists = conn.execute(
                text("SELECT id FROM app_users WHERE username='admin' LIMIT 1")
            ).first()
            if not admin_exists:
                conn.execute(
                    text(
                        "INSERT INTO app_users (username, display_name, role, is_active, created_at, updated_at) "
                        "VALUES ('admin', '系统管理员', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                    )
                )
                conn.commit()

        # 迁移12: owner_user_id 列（按人员隔离）
        def ensure_owner_column(table_name: str):
            current_cols = [c["name"] for c in inspect(engine).get_columns(table_name)]
            if "owner_user_id" not in current_cols:
                with engine.connect() as conn:
                    conn.execute(
                        text(
                            f"ALTER TABLE {table_name} "
                            "ADD COLUMN owner_user_id INTEGER REFERENCES app_users(id) DEFAULT 1"
                        )
                    )
                    conn.execute(text(f"UPDATE {table_name} SET owner_user_id=1 WHERE owner_user_id IS NULL"))
                    conn.commit()

        for table in [
            "user_contexts",
            "decisions",
            "decision_reviews",
            "decision_changelogs",
            "decision_categories",
            "notes",
            "note_categories",
        ]:
            ensure_owner_column(table)
    except Exception:
        pass  # 表可能还不存在，忽略
