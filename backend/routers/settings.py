"""系统设置 API - 自动拉取、定时任务等配置"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import get_db
from models.models import Setting
from schemas import SettingUpdate, SettingResponse

router = APIRouter(prefix="/api/settings", tags=["系统设置"])

DEFAULT_SETTINGS = {
    "auto_fetch_enabled": "false",
    "auto_fetch_interval_hours": "12",
    "important_figures": "",
    "sensitive_words": "",
}


def _get_setting(db: Session, key: str) -> str:
    """获取设置值，不存在则返回默认值"""
    setting = db.query(Setting).filter(Setting.key == key).first()
    if setting:
        return setting.value
    return DEFAULT_SETTINGS.get(key, "")


def _set_setting(db: Session, key: str, value: str):
    """设置键值对，不存在则创建"""
    setting = db.query(Setting).filter(Setting.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = Setting(key=key, value=value, description="")
        db.add(setting)
    db.commit()


@router.get("/", response_model=SettingResponse)
def get_settings(db: Session = Depends(get_db)):
    """获取所有系统设置"""
    enabled = _get_setting(db, "auto_fetch_enabled") == "true"
    interval = int(_get_setting(db, "auto_fetch_interval_hours") or "12")
    figures = _get_setting(db, "important_figures")
    sensitive = _get_setting(db, "sensitive_words")
    return SettingResponse(
        auto_fetch_enabled=enabled,
        auto_fetch_interval_hours=interval,
        important_figures=figures,
        sensitive_words=sensitive,
    )


@router.put("/", response_model=SettingResponse)
def update_settings(data: SettingUpdate, db: Session = Depends(get_db)):
    """更新系统设置"""
    _set_setting(db, "auto_fetch_enabled", "true" if data.auto_fetch_enabled else "false")
    _set_setting(db, "auto_fetch_interval_hours", str(data.auto_fetch_interval_hours))
    _set_setting(db, "important_figures", data.important_figures)
    _set_setting(db, "sensitive_words", data.sensitive_words)
    return get_settings(db)
