import { useState, useEffect } from 'react';
import { Plus, Trash2, Brain } from 'lucide-react';
import { contextsApi } from '../api/client';
import type { UserContext } from '../api/client';

export default function Contexts() {
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ domain: '', description: '', current_focus: '', goals: '', priority: 5 });

  useEffect(() => { loadContexts(); }, []);

  const loadContexts = async () => {
    setLoading(true);
    setContexts(await contextsApi.list());
    setLoading(false);
  };

  const handleSubmit = async () => {
    await contextsApi.create({
      ...form,
      goals: form.goals.split('\n').map(g => g.trim()).filter(Boolean),
    });
    setShowForm(false);
    setForm({ domain: '', description: '', current_focus: '', goals: '', priority: 5 });
    loadContexts();
  };

  const handleDelete = async (id: number) => {
    await contextsApi.delete(id);
    loadContexts();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">关注领域</h2>
          <p className="text-slate-500 mt-1">设定你关注的领域和目标，AI 将据此过滤和推送信息</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
          <Plus className="w-4 h-4" />添加领域
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold mb-4 text-slate-800 dark:text-white">添加关注领域</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">领域名称</label>
              <input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" placeholder="如：人工智能、个人成长" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">优先级 (1-10)</label>
              <input type="number" min={1} max={10} value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">描述</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={2} placeholder="这个领域关注什么？" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">当前重点</label>
              <textarea value={form.current_focus} onChange={e => setForm({ ...form, current_focus: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={2} placeholder="当前在这个领域重点关注什么方向？" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">目标（每行一个）</label>
              <textarea value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={3} placeholder="短期目标...
中期目标..." />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">保存</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">取消</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {contexts.map((c) => (
          <div key={c.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-800 dark:text-white">{c.domain}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.priority >= 7 ? 'bg-red-100 text-red-700' :
                      c.priority >= 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>P{c.priority}</span>
                  </div>
                  {c.description && <p className="text-sm text-slate-500 mt-1">{c.description}</p>}
                </div>
              </div>
              <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {c.current_focus && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">当前重点</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{c.current_focus}</p>
              </div>
            )}
            {c.goals?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 font-medium mb-2">目标</p>
                <div className="space-y-1">
                  {c.goals.map((g, i) => (
                    <p key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      {g}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {contexts.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>还没有设置关注领域</p>
            <p className="text-sm mt-1">添加领域后 AI 才能精准为你推送相关信息</p>
          </div>
        )}
      </div>
    </div>
  );
}
