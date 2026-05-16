import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, GitBranch, Trash2 } from 'lucide-react';
import { decisionsApi } from '../api/client';
import type { Decision } from '../api/client';

export default function Decisions() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, abandoned: 0, due_reviews: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      decisionsApi.list(filter),
      decisionsApi.stats(),
    ]).then(([d, s]) => {
      setDecisions(d);
      setStats(s);
      setLoading(false);
    });
  }, [filter]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个决策吗？关联的复盘记录也会被删除。')) return;
    await decisionsApi.delete(id);
    const [d, s] = await Promise.all([decisionsApi.list(filter), decisionsApi.stats()]);
    setDecisions(d);
    setStats(s);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      draft: { label: '草稿', class: 'bg-slate-100 text-slate-600' },
      active: { label: '进行中', class: 'bg-green-100 text-green-700' },
      completed: { label: '已完成', class: 'bg-blue-100 text-blue-700' },
      abandoned: { label: '已放弃', class: 'bg-red-100 text-red-600' },
    };
    return map[status] || map.draft;
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">决策管理</h2>
          <p className="text-slate-500 mt-1">记录和追踪你的每一个重要决策</p>
        </div>
        <Link to="/decisions/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
          <Plus className="w-4 h-4" />新建决策
        </Link>
      </div>

      {/* 统计小条 */}
      <div className="flex gap-4 text-sm">
        <span className="text-slate-500">总计 <strong className="text-slate-800 dark:text-white">{stats.total}</strong></span>
        <span className="text-green-600">进行中 <strong>{stats.active}</strong></span>
        <span className="text-blue-600">已完成 <strong>{stats.completed}</strong></span>
        <span className="text-red-500">已放弃 <strong>{stats.abandoned}</strong></span>
        {stats.due_reviews > 0 && (
          <span className="text-amber-600 font-medium">待复盘 {stats.due_reviews}</span>
        )}
      </div>

      {/* 筛选 */}
      <div className="flex gap-2">
        {['all', 'draft', 'active', 'completed', 'abandoned'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}>{f === 'all' ? '全部' : f === 'draft' ? '草稿' : f === 'active' ? '进行中' : f === 'completed' ? '已完成' : '已放弃'}</button>
        ))}
      </div>

      <div className="grid gap-4">
        {decisions.map((d) => {
          const badge = getStatusBadge(d.status);
          return (
            <div key={d.id} onClick={() => navigate(`/decisions/${d.id}`)}
              className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-800 dark:text-white truncate">{d.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badge.class}`}>{badge.label}</span>
                  </div>
                  {d.description && <p className="text-sm text-slate-500 mt-1">{d.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    {d.decided_at && <span>决策于 {new Date(d.decided_at).toLocaleDateString('zh-CN')}</span>}
                    {d.next_review_date && (
                      <span className={new Date(d.next_review_date) < new Date() ? 'text-amber-600 font-medium' : ''}>
                        下次复盘: {new Date(d.next_review_date).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                    <span>信心指数: {d.confidence_score}/10</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {d.chosen_option && (
                    <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg text-right">
                      <p className="text-xs text-green-600 dark:text-green-400">选择</p>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">{d.chosen_option}</p>
                    </div>
                  )}
                  <button onClick={(e) => handleDelete(e, d.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="删除">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {d.related_domains?.length > 0 && (
                <div className="flex gap-1 mt-3">
                  {d.related_domains.map((domain) => (
                    <span key={domain} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500">{domain}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {decisions.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>还没有决策记录</p>
            <p className="text-sm mt-1">从收件箱的信息创建决策，或手动添加</p>
          </div>
        )}
      </div>
    </div>
  );
}
