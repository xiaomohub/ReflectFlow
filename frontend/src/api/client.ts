/** API 客户端 - 与后端 FastAPI 交互 */

const BASE = '';  // 通过 Vite proxy 代理

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ===== 信息源 =====
export interface Source {
  id: number;
  name: string;
  source_type: string;
  url: string;
  description: string;
  enabled: boolean;
  fetch_interval: number;
  tags: string[];
  config?: Record<string, string>;
  skip_filter?: boolean;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export const sourcesApi = {
  list: () => request<Source[]>('/api/sources/'),
  create: (data: Partial<Source>) => request<Source>('/api/sources/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Source>) => request<Source>(`/api/sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/api/sources/${id}`, { method: 'DELETE' }),
  articles: (sourceId: number, limit?: number) =>
    request<Article[]>(`/api/sources/${sourceId}/articles${limit ? `?limit=${limit}` : ''}`),
  batchImport: (items: unknown[]) =>
    request<{ message: string; imported: number; errors: { index: number; name: string; error: string }[] }>('/api/sources/batch-import', { method: 'POST', body: JSON.stringify(items) }),
  batchDelete: (sourceIds: number[]) =>
    request<{ message: string; deleted: number }>('/api/sources/batch-delete', { method: 'POST', body: JSON.stringify(sourceIds) }),
};

// ===== 文章 =====
export interface Article {
  id: number;
  source_id: number | null;
  title: string;
  url: string;
  content: string;
  summary: string;
  author: string;
  ai_analysis: Record<string, unknown>;
  relevance_score: number;
  relevance_reason: string;
  suggested_action: string;
  filtered_at: string | null;
  status: string;
  is_read: boolean;
  is_starred: boolean;
  created_at: string;
  read_at: string | null;
  updated_at: string;
}

export interface ArticlePage {
  items: Article[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface ArticleCategories {
  by_source: CategoryCount[];
  by_action: CategoryCount[];
  by_status: CategoryCount[];
  by_domain: CategoryCount[];
  total: number;
  unread: number;
}

export const articlesApi = {
  list: (params?: { status?: string; is_read?: boolean; suggested_action?: string; sort_by?: string; page?: number; page_size?: number; source_id?: number; tag?: string; domain?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.is_read !== undefined) q.set('is_read', String(params.is_read));
    if (params?.suggested_action) q.set('suggested_action', params.suggested_action);
    if (params?.sort_by) q.set('sort_by', params.sort_by);
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    if (params?.source_id) q.set('source_id', String(params.source_id));
    if (params?.tag) q.set('tag', params.tag);
    if (params?.domain) q.set('domain', params.domain);
    return request<ArticlePage>(`/api/articles/?${q}`);
  },
  categories: () => request<ArticleCategories>('/api/articles/categories'),
  inbox: () => request<Article[]>('/api/articles/inbox'),
  get: (id: number) => request<Article>(`/api/articles/${id}`),
  update: (id: number, data: Partial<Article>) => request<Article>(`/api/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  filter: (articleIds?: number[]) =>
    request<{ filtered_articles: Article[]; total_count: number; high_relevance_count: number }>(
      '/api/articles/filter',
      { method: 'POST', body: JSON.stringify({ article_ids: articleIds || [] }) }
    ),
  fetch: (sourceId?: number) =>
    request<{ message: string }>(`/api/articles/fetch${sourceId ? `?source_id=${sourceId}` : ''}`, { method: 'POST' }),
  delete: (id: number) => request(`/api/articles/${id}`, { method: 'DELETE' }),
  batchUpdate: (articleIds: number[], updates: Record<string, unknown>, filters?: Record<string, unknown>) =>
    request<{ message: string }>('/api/articles/batch-update', { method: 'POST', body: JSON.stringify({ article_ids: articleIds, updates, filters: filters || {} }) }),
  batchDelete: (articleIds: number[], filters?: Record<string, unknown>) =>
    request<{ message: string }>('/api/articles/batch-delete', { method: 'POST', body: JSON.stringify({ article_ids: articleIds, filters: filters || {} }) }),
};

// ===== 用户领域 =====
export interface UserContext {
  id: number;
  domain: string;
  description: string;
  current_focus: string;
  goals: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const contextsApi = {
  list: () => request<UserContext[]>('/api/contexts/'),
  create: (data: Partial<UserContext>) => request<UserContext>('/api/contexts/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<UserContext>) => request<UserContext>(`/api/contexts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/api/contexts/${id}`, { method: 'DELETE' }),
};

// ===== 决策 =====
export interface DecisionOption {
  name: string;
  pros: string[];
  cons: string[];
  score: number;
}

export interface Decision {
  id: number;
  title: string;
  description: string;
  context: string;
  original_context: string;
  environment_snapshot: Record<string, unknown>;
  article_id: number | null;
  category_id: number | null;
  related_domains: string[];
  options: DecisionOption[];
  chosen_option: string;
  rationale: string;
  ai_advice: string;
  ai_advice_used: boolean;
  status: string;
  confidence_score: number;
  review_interval_days: number;
  next_review_date: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  decided_at: string | null;
  updated_at: string;
}

export interface DecisionReview {
  id: number;
  decision_id: number;
  review_date: string;
  outcome: string;
  outcome_score: number;
  lessons_learned: string;
  what_went_well: string;
  what_to_improve: string;
  next_steps: string;
  mood: string;
  progress: string;
  adjusted_plan: string;
  is_progress_update: boolean;
  created_at: string;
}

export interface DecisionChangeLog {
  id: number;
  decision_id: number;
  changed_at: string;
  field_name: string;
  old_value: string;
  new_value: string;
  change_reason: string;
}

// ===== 决策分类 =====
export interface DecisionCategory {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface DecisionPage {
  items: Decision[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const decisionsApi = {
  list: (params?: { status?: string; category_id?: number; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.category_id) q.set('category_id', String(params.category_id));
    if (params?.page) q.set('page', String(params.page));
    if (params?.page_size) q.set('page_size', String(params.page_size));
    return request<DecisionPage>(`/api/decisions/?${q}`);
  },
  stats: () => request<{ total: number; active: number; completed: number; abandoned: number; due_reviews: number }>('/api/decisions/stats'),
  dueReviews: () => request<Decision[]>('/api/decisions/due-reviews'),
  get: (id: number) => request<Decision>(`/api/decisions/${id}`),
  create: (data: Partial<Decision>) => request<Decision>('/api/decisions/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Decision>) => request<Decision>(`/api/decisions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/api/decisions/${id}`, { method: 'DELETE' }),
  addReview: (decisionId: number, data: Partial<DecisionReview>) =>
    request<DecisionReview>(`/api/decisions/${decisionId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  getReviews: (decisionId: number) => request<DecisionReview[]>(`/api/decisions/${decisionId}/reviews`),
  getChangeLog: (decisionId: number) => request<DecisionChangeLog[]>(`/api/decisions/${decisionId}/changelog`),
  aiAdvice: (data: { title: string; context: string; options: DecisionOption[]; related_domains: string[] }) =>
    request<{ advice: string; recommended_option: string | null; analysis: string }>('/api/decisions/ai-advice', { method: 'POST', body: JSON.stringify(data) }),
  deleteReview: (decisionId: number, reviewId: number) =>
    request(`/api/decisions/${decisionId}/reviews/${reviewId}`, { method: 'DELETE' }),
  // 分类
  listCategories: () => request<DecisionCategory[]>('/api/decisions/categories'),
  createCategory: (data: Partial<DecisionCategory>) => request<DecisionCategory>('/api/decisions/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: number, data: Partial<DecisionCategory>) => request<DecisionCategory>(`/api/decisions/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request(`/api/decisions/categories/${id}`, { method: 'DELETE' }),
};

// ===== 人格 Skills 分析 =====
export interface PersonaInfo {
  id: string;
  name: string;
  english_name: string;
  emoji: string;
  style: string;
  description: string;
}

export interface PersonaAnalysis {
  persona_id: string;
  persona_name: string;
  persona_style: string;
  emoji: string;
  analysis: string;
  advice: string;
  confidence: number;
  key_questions: string[];
  risk_warnings: string[];
}

export const skillsApi = {
  listPersonas: () => request<PersonaInfo[]>('/api/skills/personas'),
  analyze: (data: { decision_id?: number; title?: string; context?: string; options?: DecisionOption[]; persona_ids?: string[] }) =>
    request<{ analyses: PersonaAnalysis[] }>('/api/skills/analyze', { method: 'POST', body: JSON.stringify(data) }),
};

// ===== 系统设置 =====
export interface AppSettings {
  auto_fetch_enabled: boolean;
  auto_fetch_interval_hours: number;
  important_figures: string;
  sensitive_words: string;
}

export const settingsApi = {
  get: () => request<AppSettings>('/api/settings/'),
  update: (data: AppSettings) => request<AppSettings>('/api/settings/', { method: 'PUT', body: JSON.stringify(data) }),
};

// ===== 笔记 =====
export interface NoteCategory {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  category_id: number | null;
  tags: string[];
  is_published: boolean;
  ai_skills: Record<string, unknown>[];
  word_count: number;
  created_at: string;
  updated_at: string;
}

export const notesApi = {
  list: (params?: { category_id?: number; tag?: string }) => {
    const q = new URLSearchParams();
    if (params?.category_id) q.set('category_id', String(params.category_id));
    if (params?.tag) q.set('tag', params.tag);
    const qs = q.toString();
    return request<Note[]>(`/api/notes/${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => request<Note>(`/api/notes/${id}`),
  create: (data: Partial<Note>) => request<Note>('/api/notes/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Note>) => request<Note>(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/api/notes/${id}`, { method: 'DELETE' }),
  download: (id: number) => `${BASE}/api/notes/${id}/download`,
  extractSkills: (id: number) => request<{ skills: Record<string, unknown>[] }>(`/api/notes/${id}/extract-skills`, { method: 'POST' }),
  search: (query: string) => request<Note[]>(`/api/notes/search?query=${encodeURIComponent(query)}`),
  listCategories: () => request<NoteCategory[]>('/api/notes/categories'),
  createCategory: (data: Partial<NoteCategory>) => request<NoteCategory>('/api/notes/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: number, data: Partial<NoteCategory>) => request<NoteCategory>(`/api/notes/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request(`/api/notes/categories/${id}`, { method: 'DELETE' }),
};
