<p align="center">
  <h1 align="center">ReflectFlow</h1>
  <p align="center"><i>Collect · Filter · Decide · Review</i></p>
  <p align="center">
    A personal reflection system that helps you cut through information noise,
    make better decisions, and review them systematically.
  </p>
</p>

---

## Overview

ReflectFlow is a full-stack personal knowledge and decision management system. It helps you:

1. **Collect** — Subscribe to RSS feeds, web pages, and other sources to aggregate information in one place.
2. **Filter** — Use AI (LLM) to automatically score and rank articles by relevance to your interests.
3. **Decide** — Turn important articles into structured decisions with options, pros/cons, and AI-assisted analysis.
4. **Review** — Schedule periodic reviews of past decisions, track outcomes, and learn from experience.

It's designed for independent thinkers, makers, and lifelong learners who want to turn information overload into actionable wisdom.

---

## Tech Stack

| Layer   | Technology                                                      |
| ------- | --------------------------------------------------------------- |
| Frontend | React 19 + TypeScript + Vite 8 + TailwindCSS 4 + React Router 7 |
| Backend | Python FastAPI + SQLAlchemy + SQLite                             |
| AI      | OpenAI-compatible API (DeepSeek / GPT / Qwen, etc.)             |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### One-Click Launch

Double-click `start.bat` — it will automatically:

1. Create a Python virtual environment and install backend dependencies.
2. Install frontend npm dependencies.
3. Start the backend at `http://localhost:8000`.
4. Start the frontend at `http://localhost:5173`.

### Manual Launch

**Backend:**

```bash
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Configuration: AI Provider

Copy `backend/.env.example` to `backend/.env` and fill in your API credentials:

```env
LLM_API_KEY=sk-your-key-here
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

For DeepSeek:

```env
LLM_API_KEY=sk-your-deepseek-key
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```

> Without `.env`, the system falls back to keyword matching — all features still work without AI.

---

## Usage Guide / 使用说明

### 第一步：添加信息源

进入「信息源」页面，点击「添加源」，填入：
- **名称** — 如 "Hacker News"
- **类型** — `rss`（推荐）、`webpage`、`xueqiu`（雪球用户）
- **地址** — RSS 地址、网页 URL、或雪球用户主页 `https://xueqiu.com/{user_id}`
- **标签** — 方便分类

#### 雪球用户订阅

在创建雪球类型源时，按页面提示填写 Cookie（登录 xueqiu.com → F12 → Application → Cookies → xueqiu.com → 复制全部）。系统内置 5 分钟抓取间隔保护。

### 第二步：设定关注领域

进入「关注领域」页面，设定你感兴趣的领域。越具体，AI 过滤越精准。

示例：
| 字段 | 内容 |
|------|------|
| 领域 | AI/LLM |
| 描述 | 关注大模型应用落地和工具链 |
| 当前焦点 | 评估 DeepSeek 与 GPT 在实际项目中的表现 |
| 目标 | 搭建一套 AI 驱动的个人知识系统 |

### 第三步：抓取与过滤

1. 进入「信息源」→ 点击「抓取」
2. 进入「收件箱」→ 点击「AI 过滤」
3. 文章按相关度从高到低排序

### 第四步：决策与复盘

阅读文章 → 创建决策 → 记录选项与分析 → 定期回顾决策结果。

---

## API Documentation

Once the backend is running, visit **http://localhost:8000/docs** for Swagger UI.

| Endpoint                                      | Description                          |
| --------------------------------------------- | ------------------------------------ |
| `GET /api/health`                             | Health check                         |
| `POST /api/sources/`                          | Create a source                      |
| `GET /api/sources/`                           | List all sources                     |
| `POST /api/articles/fetch`                    | Trigger article fetching             |
| `POST /api/articles/filter`                   | AI-powered article filtering         |
| `GET /api/articles/inbox`                     | Inbox (sorted by relevance)          |
| `POST /api/contexts/`                         | Create an interest domain            |
| `POST /api/decisions/`                        | Create a decision                    |
| `POST /api/decisions/ai-advice`               | Get AI-generated decision advice     |
| `POST /api/decisions/{id}/reviews`            | Create a decision review             |
| `GET /api/decisions/due-reviews`              | List decisions due for review        |

---

## Project Structure

```
├── start.bat                   # One-click startup script
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── schemas.py              # Pydantic models
│   ├── requirements.txt
│   ├── .env.example            # AI config template
│   ├── models/
│   │   ├── database.py         # DB engine & session
│   │   └── models.py           # ORM models
│   ├── routers/
│   │   ├── sources.py          # Source CRUD
│   │   ├── articles.py         # Article CRUD + filter + fetch
│   │   ├── contexts.py         # Interest domain CRUD
│   │   └── decisions.py        # Decision CRUD + review
│   └── services/
│       ├── ai_filter.py        # AI filtering & advice
│       ├── source_fetcher.py   # RSS/web/xueqiu fetcher
│       └── decision_service.py # Decision lifecycle
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx             # Router config
        ├── api/client.ts       # API client
        ├── components/
        │   └── Layout.tsx      # Sidebar navigation
        └── pages/
            ├── Dashboard.tsx
            ├── Inbox.tsx
            ├── Sources.tsx
            ├── Contexts.tsx
            ├── Decisions.tsx
            ├── DecisionDetail.tsx
            └── Review.tsx
```

---

## License

MIT
