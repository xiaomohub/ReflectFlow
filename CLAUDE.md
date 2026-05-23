# ReflectFlow 项目开发规范

## 项目定位

ReflectFlow 是一个个人知识管理与投资决策辅助系统。核心流程：**采集 → 过滤 → 决策 → 复盘**。目标用户是独立思考者、投资者和终身学习者。

## 技术栈

- **前端**: React 19 + TypeScript + Vite 8 + TailwindCSS 4 + React Router 7
- **后端**: Python FastAPI + SQLAlchemy 2.0 + SQLite
- **AI**: OpenAI-compatible API (DeepSeek/GPT/Qwen 等)，可选

## 架构规则

### 目录结构
```
backend/
  main.py            # FastAPI 入口，CORS，生命周期
  schemas.py         # Pydantic 请求/响应模型
  models/
    database.py      # 数据库引擎、session、init_db()
    models.py        # ORM 模型定义
  routers/           # API 路由 (每个资源一个文件)
  services/          # 业务逻辑层
frontend/
  src/
    main.tsx         # 入口
    App.tsx          # 路由配置
    api/client.ts    # 类型化 API 客户端
    components/      # 通用组件
    pages/           # 页面组件 (对应路由)
```

### 约束
- **单用户本地应用**，不做用户认证/多用户
- **数据库**: SQLite，`init_db()` 中做手动列迁移
- **后端调度**: 使用 FastAPI 进程内 daemon 线程（不用 Celery/RQ）
- **LLM 可选**: 无 API key 时退回关键词匹配
- **前端请求**: 通过 Vite proxy `/api` → `localhost:8000`

## API 规范

- 路由前缀: `/api/{resource}`
- 响应格式: 简单对象或列表，不分页的直接返回数组
- 分页: `ArticlePageResponse(page, page_size, total, total_pages, items)`
- 批量操作: `POST /api/{resource}/batch-update` 和 `POST /api/{resource}/batch-delete`，支持 `filters.select_all` 跨页全选
- 枚举值: 所有的 status/action 字段用小写英文

## 代码规范

### 后端 Python
- **字符串**: 全用双引号
- **命名**: snake_case（函数/变量）, PascalCase（类）
- **类型注解**: 函数参数和返回值加类型注解，ORM 模型字段除外
- **import顺序**: 标准库 → 第三方 → 本地，每组空行分隔
- **Router 文件**: 使用 `APIRouter(prefix="/api/{resource}", tags=[...])`，每个文件一个 router
- **Service 类**: 构造函数接收 `db: Session`，独立于 router
- **时间处理**: 统一使用 `utils.py` 中的 `beijing_now()`
- **错误处理**: 使用 `HTTPException`，不返回自定义错误对象

### 前端 TypeScript
- **缩进**: 2空格
- **命名**: camelCase（变量/函数）, PascalCase（组件/类型）
- **分号**: 必须加分号
- **类型**: 禁止使用 `any`，用 `unknown` 替代
- **API 调用**: 统一通过 `api/client.ts` 导出的 `xxxApi` 对象
- **组件**: 函数组件 + Hooks，不用 class 组件
- **样式**: TailwindCSS 类，不用 CSS 文件
- **错误处理**: API 调用用 try/catch，显示 toast 或错误状态
- **加载状态**: 每个页面必须有 loading spinner

## 数据库模式

### Source（信息源）
- `source_type`: rss / rsshub / webpage / api / xueqiu
- `config`: JSON 字段，存 Cookie/Headers 等
- `skip_filter`: true 表示跳过 AI 过滤

### Article（文章）
- `status`: new / reviewed / archived / actioned
- `suggested_action`: read / archive / decide / ignore
- `relevance_score`: 0-1 float
- `ai_analysis`: JSON { matched_domains, tags, ... }

### UserContext（关注领域）
- `priority`: 1-10
- `is_active`: 是否启用

## 关键业务逻辑

### 信息源抓取
- 5 分钟内不重复抓取同一源
- RSS: 最多取 50 条，按(title, source_id)去重
- 雪球: 需要 Cookie 认证，最多取 30 条

### AI 过滤
- 每批 10 条发送给 LLM
- 敏感词匹配到的文章自动删除
- 重要人物文章 relevance_score +0.2
- 无 LLM 时退回到关键词匹配

## 开发注意事项

- `feeds.opml` 已有大量源，不要重复添加
- 不要在代码中添加 emoji
- `source_type` 中的 `rsshub` 和 `rss` 使用相同的 `_fetch_rss` 方法
- 批量接口的 `filters.select_all` 为 true 时忽略 `article_ids`
- 前端 `prettier` 格式化使用 `printWidth: 100`
- 不做过度抽象——3 行相似代码好过提前封装
- 不做向后兼容——只需要关注当前代码库的状态
- 不加注释除非 WHY 不明显的逻辑

## 已知技术债务

1. `by_domain` 分类统计只统计 AI 过滤后的文章
2. 笔记分类 API 偶尔返回重复条目
3. 雪球 Cookie 手动获取，易过期
4. `_fetch_rss` 中 `content_hash` 算好但未使用
5. `api` source_type 是存根未实现
