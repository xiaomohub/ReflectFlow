# 个人复盘系统

> 信息收集 → AI 过滤 → 决策管理 → 定期复盘

一款面向个人的信息处理与决策复盘工具。通过订阅信息源（RSS/网页），结合 AI 进行内容过滤和相关性评分，帮你从信息过载中提炼出真正值得关注的内容，转为可执行的决策，并定期回顾复盘。

## 功能概览

| 模块 | 功能 |
|------|------|
| **信息源管理** | 添加 RSS / 网页等订阅源，定时抓取 |
| **文章收件箱** | AI 自动评分排序，标记已读/星标 |
| **关注领域** | 设定你的兴趣方向，驱动 AI 过滤 |
| **决策管理** | 基于文章创建决策，记录选项与分析 |
| **决策复盘** | 定期回顾决策结果，评估 outcome |
| **AI 辅助** | 接入 LLM 提供决策建议和内容分析 |

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 + TypeScript + Vite 8 + TailwindCSS 4 + React Router 7 |
| 后端 | Python FastAPI + SQLAlchemy + SQLite |
| AI | OpenAI 兼容 API（可对接 DeepSeek / Qwen / GPT 等） |

## 快速启动

### 前置要求

- Python 3.10+
- Node.js 18+

### 一键启动

直接双击运行 `start.bat`，脚本会自动：

1. 创建 Python 虚拟环境并安装后端依赖
2. 安装前端 npm 依赖
3. 启动后端服务 (http://localhost:8000)
4. 启动前端服务 (http://localhost:5173)

### 手动启动

**后端：**

```bash
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**前端：**

```bash
cd frontend
npm install
npm run dev
```

启动后浏览器打开 **http://localhost:5173** 即可使用。

## 配置 AI

复制 `backend/.env.example` 为 `backend/.env`，填入你的 API 信息：

```env
LLM_API_KEY=sk-your-key-here
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

也可以用 DeepSeek：

```env
LLM_API_KEY=sk-your-deepseek-key
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```

> 不配置 `.env` 不影响使用，系统会自动降级为关键词匹配模式。

## 使用流程

```
添加信息源 (RSS / 网页 / 雪球)
    ↓
设定关注领域 (如 AI、投资、Startups)
    ↓
抓取文章 → 进入收件箱
    ↓
AI 过滤 → 按相关度评分排序
    ↓
阅读文章 → 创建决策
    ↓
定期复盘 → 回顾决策结果
```

### 第一步：添加信息源

进入「信息源」页面，点击「添加源」，填入：
- **名称**：如"Hacker News"
- **类型**：`rss`（推荐）、`webpage`、`xueqiu`（雪球用户）
- **地址**：RSS 地址、网页 URL、或雪球用户主页 `https://xueqiu.com/{user_id}`
- **标签**：方便分类

#### 雪球用户订阅

> 需要登录态。在创建雪球类型信息源时，按页面提示填写 Cookie：
>
> 登录 xueqiu.com → F12 打开开发者工具 → Application → Cookies → xueqiu.com → 右键复制全部 → 粘贴到 Cookie 输入框
>
> 系统内置 5 分钟抓取间隔保护，不会触发风控。

### 第二步：设定关注领域

进入「关注领域」页面，设定你感兴趣的领域。越具体，AI 过滤越精准。

例如：
- 领域：`AI/LLM`
- 描述：`关注大模型应用落地和工具链`
- 当前焦点：`评估 DeepSeek 与 GPT 在实际项目中的表现`
- 目标：`搭建一套 AI 驱动的个人知识系统`

### 第三步：抓取与过滤

1. 进入「信息源」→ 点击「抓取」
2. 进入「收件箱」→ 点击「AI 过滤」
3. 文章按相关度从高到低排序，一目了然

### 第四步：决策与复盘

阅读文章后，可以创建决策 → 记录选项、分析利弊 → 定期回顾决策结果。

## API 文档

启动后端后访问 **http://localhost:8000/docs** 查看交互式 API 文档（Swagger UI）。

主要接口：

| 路径 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `POST /api/sources/` | 创建信息源 |
| `GET /api/sources/` | 列出所有信息源 |
| `POST /api/articles/fetch` | 触发抓取 |
| `POST /api/articles/filter` | AI 过滤文章 |
| `GET /api/articles/inbox` | 收件箱（按评分排序） |
| `POST /api/contexts/` | 创建关注领域 |
| `POST /api/decisions/` | 创建决策 |
| `POST /api/decisions/ai-advice` | 获取 AI 决策建议 |
| `POST /api/decisions/{id}/reviews` | 创建决策复盘 |
| `GET /api/decisions/due-reviews` | 获取到期需复盘列表 |

## 项目结构

```
├── start.bat                 # 一键启动脚本
├── README.md
├── backend/
│   ├── main.py               # FastAPI 入口
│   ├── schemas.py            # Pydantic 数据模型
│   ├── requirements.txt
│   ├── .env.example          # AI 配置模板
│   ├── models/
│   │   ├── database.py       # 数据库引擎 & 会话
│   │   └── models.py         # ORM 模型
│   ├── routers/
│   │   ├── sources.py        # 信息源 CRUD
│   │   ├── articles.py       # 文章 CRUD + 过滤 + 抓取
│   │   ├── contexts.py       # 关注领域 CRUD
│   │   └── decisions.py      # 决策 CRUD + 复盘
│   └── services/
│       ├── ai_filter.py      # AI 过滤 & 决策建议
│       ├── source_fetcher.py # RSS/网页抓取
│       └── decision_service.py # 决策生命周期管理
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx           # 路由配置
        ├── api/client.ts     # API 客户端
        ├── components/
        │   └── Layout.tsx    # 侧边栏导航布局
        └── pages/
            ├── Dashboard.tsx
            ├── Inbox.tsx
            ├── Sources.tsx
            ├── Contexts.tsx
            ├── Decisions.tsx
            ├── DecisionDetail.tsx
            └── Review.tsx
```

## 关于雪球（Xueqiu）订阅

> 这是对你上一个问题的回答。

当前系统支持 **RSS** 和 **网页抓取** 两种信息源类型。对于雪球特定用户的发言：

**可行的方案：**
- 如果该雪球用户有个人 RSS 输出地址，直接添加为 `rss` 源即可
- 雪球用户主页（如 `https://xueqiu.com/{user_id}`）可以用 `webpage` 类型抓取，但受限于：
  - 雪球页面需要登录才能查看完整内容
  - 页面内容可能是 JavaScript 动态渲染的，`requests` + `BeautifulSoup` 不一定能抓到

**更好的方案：**
- 后续可以针对雪球写一个专门的抓取器（类似 `source_fetcher.py` 里的 `_fetch_api` 预留位），通过雪球的 API 或爬虫来获取特定用户的发言
- 目前建议先用 RSS 源尝试，如果关注的大佬有开博客或 Newsletter，订阅 RSS 会更稳定

---

*个人复盘系统 — 让信息为你所用，而不是淹没你。*
