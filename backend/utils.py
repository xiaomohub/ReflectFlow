"""工具函数"""

from datetime import datetime, timezone, timedelta

BEIJING_TZ = timezone(timedelta(hours=8), name="Asia/Shanghai")


def beijing_now() -> datetime:
    """获取当前北京时间 (UTC+8) — 返回 naive datetime 以兼容 SQLite"""
    return datetime.now(BEIJING_TZ).replace(tzinfo=None)
