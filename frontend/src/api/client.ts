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
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export const sourcesApi = {
  list: () => request<Source[]>('/api/sources/'),
  create: (data: Partial<Source>) => request<Source>('/api/sources/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Source>) => request<Source>(`/api/sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/api/sources/${id}`, { method: 'DELETE' }),
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
  status: string;
  is_read: boolean;
  is_starred: boolean;
  created_at: string;
  read_at: string | null;
  updated_at: string;
}

export const articlesApi = {
  list: (params?: { status?: string; sort_by?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.sort_by) q.set('sort_by', params.sort_by);
    if (params?.limit) q.set('limit', String(params.limit));
    return request<Article[]>(`/api/articles/?${q}`);
  },
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
  article_id: number | null;
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
  created_at: string;
}

export const decisionsApi = {
  list: (status?: string) => request<Decision[]>(`/api/decisions/${status ? `?status=${status}` : ''}`),
  stats: () => request<{ total: number; active: number; completed: number; abandoned: number; due_reviews: number }>('/api/decisions/stats'),
  dueReviews: () => request<Decision[]>('/api/decisions/due-reviews'),
  get: (id: number) => request<Decision>(`/api/decisions/${id}`),
  create: (data: Partial<Decision>) => request<Decision>('/api/decisions/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Decision>) => request<Decision>(`/api/decisions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request(`/api/decisions/${id}`, { method: 'DELETE' }),
  addReview: (decisionId: number, data: Partial<DecisionReview>) =>
    request<DecisionReview>(`/api/decisions/${decisionId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  getReviews: (decisionId: number) => request<DecisionReview[]>(`/api/decisions/${decisionId}/reviews`),
  aiAdvice: (data: { title: string; context: string; options: DecisionOption[]; related_domains: string[] }) =>
    request<{ advice: string; recommended_option: string | null; analysis: string }>('/api/decisions/ai-advice', { method: 'POST', body: JSON.stringify(data) }),
  deleteReview: (decisionId: number, reviewId: number) =>
    request(`/api/decisions/${decisionId}/reviews/${reviewId}`, { method: 'DELETE' }),
};
