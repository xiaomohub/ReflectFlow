import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Rss, Globe, Code, MessageCircle } from 'lucide-react';
import { sourcesApi, articlesApi } from '../api/client';
import type { Source } from '../api/client';

const typeIcons: Record<string, React.ElementType> = { rss: Rss, webpage: Globe, api: Code, newsletter: Rss, xueqiu: MessageCircle };
const typeLabels: Record<string, string> = { rss: 'RSS', webpage: '网页', api: 'API', xueqiu: '雪球' };

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', source_type: 'rss', url: '', description: '', tags: '', cookies: '' });

  useEffect(() => { loadSources(); }, []);

  const loadSources = async () => {
    setLoading(true);
    const data = await sourcesApi.list();
    setSources(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    const data: Record<string, unknown> = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    if (form.source_type === 'xueqiu' && form.cookies) {
      data.config = { cookies: form.cookies };
    }
    delete data.cookies;
    await sourcesApi.create(data);
    setShowForm(false);
    setForm({ name: '', source_type: 'rss', url: '', description: '', tags: '', cookies: '' });
    loadSources();
  };

  const handleDelete = async (id: number) => {
    await sourcesApi.delete(id);
    loadSources();
  };

  const handleFetch = async (id?: number) => {
    await articlesApi.fetch(id);
    alert('拉取完成！');
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">信息源管理</h2>
          <p className="text-slate-500 mt-1">配置 RSS、网页、API 等信息来源</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleFetch()} className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <RefreshCw className="w-4 h-4" />全部拉取
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            <Plus className="w-4 h-4" />添加信息源
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold mb-4 text-slate-800 dark:text-white">添加新信息源</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">类型</label>
              <select value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm">
                <option value="rss">RSS</option>
                <option value="webpage">网页</option>
                <option value="api">API</option>
                <option value="xueqiu">雪球</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">URL</label>
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">描述</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">标签（逗号分隔）</label>
              <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
            </div>
            {form.source_type === 'xueqiu' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  雪球 Cookie
                  <span className="ml-2 text-xs text-amber-500">（必需）</span>
                </label>
                <textarea value={form.cookies} onChange={e => setForm({ ...form, cookies: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm font-mono" rows={3}
                  placeholder="登录 xueqiu.com 后，从浏览器 DevTools > Application > Cookies 复制全部 Cookie 字符串粘贴到这里" />
                <p className="text-xs text-slate-400 mt-1">如何获取：登录雪球 → F12 打开开发者工具 → 顶部"Application" → 左侧"Cookies" → 选中 xueqiu.com → 任意 Cookie 上右键 → "复制全部" → 粘贴到上面</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">保存</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-600">取消</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {sources.map((s) => {
          const Icon = typeIcons[s.source_type] || Rss;
          return (
            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-800 dark:text-white">{s.name}</h3>
                    <span className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded">{typeLabels[s.source_type] || s.source_type}</span>
                    {s.tags?.map(t => (
                      <span key={t} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">{t}</span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">{s.url}</p>
                  {s.last_fetched_at && (
                    <p className="text-xs text-slate-400 mt-1">上次拉取: {new Date(s.last_fetched_at).toLocaleString('zh-CN')}</p>
                  )}
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                    s.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>{s.enabled ? '已启用' : '已禁用'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleFetch(s.id)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors" title="拉取">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="删除">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
        {sources.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Rss className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>还没有配置信息源</p>
            <p className="text-sm mt-1">点击上方按钮添加 RSS 或网页信息源</p>
          </div>
        )}
      </div>
    </div>
  );
}
