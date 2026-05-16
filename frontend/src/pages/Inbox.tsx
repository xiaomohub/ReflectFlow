import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Sparkles, Eye, Star, GitBranch, Trash2 } from 'lucide-react';
import { articlesApi } from '../api/client';
import type { Article } from '../api/client';

export default function Inbox() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [sortBy, setSortBy] = useState('relevance_score');
  const navigate = useNavigate();

  useEffect(() => { loadInbox(); }, [sortBy]);

  const loadInbox = async () => {
    setLoading(true);
    const data = await articlesApi.list({ sort_by: sortBy, limit: 50 });
    setArticles(data);
    setLoading(false);
  };

  const handleAiFilter = async () => {
    setFiltering(true);
    await articlesApi.filter();
    loadInbox();
    setFiltering(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这篇文章吗？')) return;
    await articlesApi.delete(id);
    loadInbox();
  };

  const handleAction = async (id: number, action: string) => {
    const updates: Record<string, unknown> = {};
    if (action === 'read') updates.is_read = true;
    if (action === 'archive') { updates.is_read = true; updates.status = 'archived'; }
    if (action === 'decide') { updates.status = 'actioned'; updates.is_read = true; }
    await articlesApi.update(id, updates);
    loadInbox();
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      read: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      decide: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      archive: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
      ignore: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[action] || colors.read;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">信息收件箱</h2>
          <p className="text-slate-500 mt-1">AI 已为你筛选和排序的高价值信息</p>
        </div>
        <div className="flex gap-3">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm">
            <option value="relevance_score">按相关度</option>
            <option value="created_at">按时间</option>
          </select>
          <button onClick={handleAiFilter} disabled={filtering}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50 transition-colors">
            <Sparkles className={`w-4 h-4 ${filtering ? 'animate-spin' : ''}`} />
            {filtering ? 'AI 筛选中...' : 'AI 过滤'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <div key={a.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-slate-800 dark:text-white truncate">{a.title}</h3>
                    {a.is_starred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {a.author && <span>{a.author}</span>}
                    <span>{new Date(a.created_at).toLocaleDateString('zh-CN')}</span>
                    {a.summary && <span className="truncate max-w-md">{a.summary}</span>}
                  </div>
                  {a.relevance_reason && (
                    <p className="text-sm text-slate-500 mt-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                      {a.relevance_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getActionColor(a.suggested_action)}`}>
                    {a.suggested_action === 'decide' ? '需决策' : a.suggested_action === 'read' ? '值得读' : a.suggested_action === 'archive' ? '可存档' : '忽略'}
                  </span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    a.relevance_score >= 0.7 ? 'bg-green-100 text-green-700' :
                    a.relevance_score >= 0.4 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {(a.relevance_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => handleAction(a.id, 'read')}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors">
                  <Eye className="w-3 h-3" />标记已读
                </button>
                <button onClick={() => { handleAction(a.id, 'decide'); navigate(`/decisions/new?article=${a.id}`); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors">
                  <GitBranch className="w-3 h-3" />创建决策
                </button>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-blue-500 transition-colors">
                    查看原文
                  </a>
                )}
                <button onClick={() => handleDelete(a.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 className="w-3 h-3" />删除
                </button>
              </div>
            </div>
          ))}
          {articles.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>收件箱空空如也</p>
              <p className="text-sm mt-1">先去信息源页面拉取信息，然后点击 AI 过滤</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
