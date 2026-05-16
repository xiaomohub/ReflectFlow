# ReflectFlow 项目进度计划

> 最后更新: 2026-05-16

---

## 总体架构

```
信息源 (RSS/API/RSSHub/网页/雪球)
    ↓ 抓取
文章收件箱
    ↓ AI 过滤（按关注领域评分）
相关文章 → 决策创建 → 多视角分析 → 定期复盘
笔记系统 (Markdown + AI 技能提取)
```

---

## Phase 1: 基础架构 ✅ 已完成

- [x] FastAPI 后端骨架（main.py, models, routers, services）
- [x] React 前端骨架（App.tsx, Layout, Router）
- [x] SQLite 数据库 + SQLAlchemy ORM
- [x] 信息源 CRUD（sources router + Sources.tsx 页面）
- [x] 文章抓取（SourceFetcher: RSS / 网页 / API）
- [x] 文章收件箱（Inbox.tsx 基础版）
- [x] 关注领域 CRUD（contexts router + Contexts.tsx 页面）
- [x] Vite proxy 配置

## Phase 2: AI 过滤与决策 ✅ 已完成

- [x] AI 过滤服务（ai_filter.py — 文章相关性评分）
- [x] AI 决策建议（decision_service.py — 选项分析）
- [x] 决策 CRUD + 复盘（decisions router + Decisions.tsx + DecisionDetail.tsx）
- [x] Dashboard 概览（Dashboard.tsx）
- [x] 系统设置（settings router）

## Phase 2.5: 增强功能 ✅ 已完成

- [x] 雪球用户数据源支持（_fetch_xueqiu + Cookie 认证）
- [x] 收件箱按领域分类导航（Inbox.tsx 重构 — 领域优先设计）
- [x] 文章摘要高亮展示（快速浏览，减少点击成本）
- [x] RSSHub 集成（B站/知乎/微博/雪球/豆瓣/即刻 等平台）
- [x] `/notes/new`  spinner 修复（安全超时 + 加载状态管理）

## Phase 3: 人格 Skills 面板 ✅ 已完成

**目标**: 在决策详情页增加多视角 AI 分析面板（巴菲特/芒格等人物视角）

### 已完成
- [x] 后端: SkillsService (skills_service.py) — 5 位大师级人物定义 + LLM 角色扮演分析
- [x] 后端: skills router + Pydantic schema（/api/skills/personas, /api/skills/analyze）
- [x] 前端: skillsApi 客户端方法（client.ts）
- [x] 前端: DecisionDetail.tsx Skills 面板 UI（人物选择器 + 折叠分析卡片 + 信心指数 + 关键问题 + 风险提示）
- [x] API 路由注册到 main.py

## Phase 4: 笔记系统扩展 📝 待开始

- [ ] AI 技能提取增强（从笔记中提取可迁移技能）
- [ ] 笔记全文搜索优化
- [ ] 笔记与决策关联

## Phase 5: 数据源扩展 🌐 待开始

- [ ] RSSHub 更多平台适配
- [ ] 自定义 API 适配器
- [ ] 半自动化数据采集方案

## Phase 6: 部署与同步 ☁️ 待开始

- [ ] 服务器部署方案
- [ ] 多用户支持
- [ ] 数据库迁移规划

## Phase 7: 系统优化 ⚡ 待开始

- [ ] 批量操作全页支持
- [ ] 信息源分类管理
- [ ] 性能优化

---

## 当前 Sprint 任务列表（按优先级排序）

| # | 任务 | 状态 | 备注 |
|---|------|------|------|
| 1 | 重启后端（加载 rsshub 源类型） | ✅ 已完成 | — |
| 2 | Phase 3: 人格 Skills 面板（多视角分析） | ✅ 已完成 | 5 位大师视角 |
| 3 | 信息源分类 + 分类批量操作 | 📋 待开始 | 用户体验优化 |
| 4 | 文章批量操作支持全页 | 📋 待开始 | 当前仅限当前分页 |
| 5 | Phase 4: 笔记 AI 技能提取增强 | 📋 待开始 | 笔记系统扩展 |

---

## 技术债务 / 已知问题

- `by_domain` 分类为空：后端 `/api/articles/categories` 只统计已 AI 过滤的文章（`filtered_at.isnot(None)`）
- 笔记分类 API 返回重复条目（数据库中存在重复数据）
- 雪球 Cookie 需要用户手动获取，易过期
