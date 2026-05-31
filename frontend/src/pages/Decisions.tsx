import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, FolderPlus, ChevronLeft, ChevronRight, Edit3, Check, X, GitBranch } from 'lucide-react';
import { decisionsApi } from '../api/client';
import type { Decision, DecisionCategory } from '../api/client';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft: { label: '草稿', color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800/50', dot: 'bg-slate-400' },
  active: { label: '进行中', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10', dot: 'bg-green-500' },
  completed: { label: '已完成', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10', dot: 'bg-blue-500' },
  abandoned: { label: '已放弃', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/10', dot: 'bg-red-400' },
};

const STATUS_ORDER = ['draft', 'active', 'completed', 'abandoned'];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

export default function Decisions() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, abandoned: 0, due_reviews: 0 });
  const [categories, setCategories] = useState<DecisionCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      loadDecisions(),
      decisionsApi.stats(),
      decisionsApi.listCategories(),
    ]).then(([, s, c]) => {
      setStats(s);
      setCategories(c);
    });
  }, [page, selectedCategory]);

  const loadDecisions = async () => {
    setLoading(true);
    const result = await decisionsApi.list({
      category_id: selectedCategory ?? undefined,
      page,
      page_size: 50,
    });
    setDecisions(result.items);
    setTotal(result.total);
    setTotalPages(result.total_pages);
    setLoading(false);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, Decision[]> = { draft: [], active: [], completed: [], abandoned: [] };
    for (const d of decisions) {
      if (groups[d.status]) groups[d.status].push(d);
      else groups.draft.push(d);
    }
    return groups;
  }, [decisions]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个决策吗？关联的复盘记录也会被删除。')) return;
    await decisionsApi.delete(id);
    loadDecisions();
    const s = await decisionsApi.stats();
    setStats(s);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    await decisionsApi.createCategory({ name: newCategoryName.trim() });
    setNewCategoryName('');
    setShowNewCategory(false);
    const cats = await decisionsApi.listCategories();
    setCategories(cats);
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个分类吗？其中的决策将变为"未分类"。')) return;
    await decisionsApi.deleteCategory(id);
    if (selectedCategory === id) setSelectedCategory(null);
    const cats = await decisionsApi.listCategories();
    setCategories(cats);
    loadDecisions();
  };

  const handleRenameCategory = async (id: number) => {
    if (!editCategoryName.trim()) return;
    await decisionsApi.updateCategory(id, { name: editCategoryName.trim() });
    setEditingCategory(null);
    const cats = await decisionsApi.listCategories();
    setCategories(cats);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">决策管理</h2>
          <p className="text-slate-500 mt-1 text-sm">记录和追踪你的每一个重要决策</p>
        </div>
        <Link to="/decisions/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors">
          <Plus className="w-4 h-4" />新建决策
        </Link>
      </div>

      {/* 统计条 */}
      <div className="flex items-center gap-6 text-sm bg-white dark:bg-slate-800 rounded-xl px-5 py-3 shadow-sm border border-slate-200 dark:border-slate-700">
        <span className="text-slate-500">共 <strong className="text-slate-800 dark:text-white text-base">{stats.total}</strong> 项</span>
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>进行中 <strong className="text-green-600">{stats.active}</strong></span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>已完成 <strong className="text-blue-600">{stats.completed}</strong></span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span>已放弃 <strong className="text-red-500">{stats.abandoned}</strong></span>
        </span>
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <span className="flex-1" />
        {stats.due_reviews > 0 && (
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
            待复盘 {stats.due_reviews} 项
          </span>
        )}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs text-slate-400">{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {/* 分类筛选 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setSelectedCategory(null); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          全部
        </button>
        {categories.map(cat => (
          <div key={cat.id} className="group relative">
            {editingCategory === cat.id ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <input value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)}
                  className="w-20 px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat.id); if (e.key === 'Escape') setEditingCategory(null); }}
                />
                <button onClick={() => handleRenameCategory(cat.id)} className="p-0.5 text-green-500"><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditingCategory(null)} className="p-0.5 text-slate-400"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button
                onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            )}
            {editingCategory !== cat.id && (
              <div className="hidden group-hover:flex absolute -top-2 -right-2 items-center gap-0.5 z-10">
                <button onClick={() => { setEditingCategory(cat.id); setEditCategoryName(cat.name); }}
                  className="p-0.5 bg-white dark:bg-slate-700 rounded shadow-sm border border-slate-200 text-slate-400 hover:text-blue-500">
                  <Edit3 className="w-3 h-3" />
                </button>
                <button onClick={(e) => handleDeleteCategory(e, cat.id)}
                  className="p-0.5 bg-white dark:bg-slate-700 rounded shadow-sm border border-slate-200 text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="relative">
          {showNewCategory ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                className="w-20 px-1 py-0.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setShowNewCategory(false); }}
              />
              <button onClick={handleCreateCategory} className="p-0.5 text-green-500"><Check className="w-3 h-3" /></button>
              <button onClick={() => setShowNewCategory(false)} className="p-0.5 text-slate-400"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => setShowNewCategory(true)}
              className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors" title="新建分类">
              <FolderPlus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 看板 */}
      {decisions.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <GitBranch className="w-14 h-14 mx-auto mb-4 opacity-40" />
          <p className="text-base">还没有决策记录</p>
          <p className="text-sm mt-1">从收件箱的信息创建决策，或手动添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 min-h-[500px]">
          {STATUS_ORDER.map(status => {
            const cfg = STATUS_CONFIG[status];
            const items = grouped[status] || [];
            return (
              <div key={status} className={`rounded-xl ${cfg.bg} border border-slate-200 dark:border-slate-700 flex flex-col`}>
                {/* 列头 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs text-slate-400 font-medium">{items.length}</span>
                  </div>
                  <Link to={`/decisions/new`}
                    className="p-1 text-slate-400 hover:text-blue-500 transition-colors" title={`新建${cfg.label}决策`}>
                    <Plus className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {/* 卡片列表 */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[600px]">
                  {items.map(d => (
                    <div key={d.id} onClick={() => navigate(`/decisions/${d.id}`)}
                      className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer"
                    >
                      {/* 分类标签 + 时间 */}
                      <div className="flex items-center gap-2 mb-2">
                        {d.category_id && categories.find(c => c.id === d.category_id) && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                            {categories.find(c => c.id === d.category_id)!.name}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 ml-auto">{timeAgo(d.created_at)}</span>
                      </div>

                      {/* 标题 */}
                      <h3 className="text-sm font-medium text-slate-800 dark:text-white leading-snug line-clamp-2 mb-3">{d.title}</h3>

                      {/* 指标 */}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>信心 <strong className={d.confidence_score >= 7 ? 'text-green-500' : d.confidence_score >= 4 ? 'text-amber-500' : 'text-red-400'}>{d.confidence_score}</strong></span>
                        <span>选项 <strong>{d.options.length}</strong></span>
                        {d.chosen_option && (
                          <span className="ml-auto text-green-600 dark:text-green-400 truncate max-w-[100px]" title={d.chosen_option}>
                            选择 {d.chosen_option}
                          </span>
                        )}
                        {d.next_review_date && new Date(d.next_review_date) < new Date() && status === 'active' && (
                          <span className="ml-auto text-amber-600 font-medium px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded text-xs">待复盘</span>
                        )}
                      </div>

                      {/* 领域标签 */}
                      {d.related_domains?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-700">
                          {d.related_domains.map(domain => (
                            <span key={domain} className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{domain}</span>
                          ))}
                        </div>
                      )}

                      {/* 删除 */}
                      <button onClick={(e) => handleDelete(e, d.id)}
                        className="absolute top-2 right-2 p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all" title="删除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-300 dark:text-slate-600">
                      <p className="text-xs">暂无决策</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
