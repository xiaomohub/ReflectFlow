import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, GitBranch, Trash2, FolderOpen, FolderPlus, ChevronLeft, ChevronRight, Edit3, Check, X } from 'lucide-react';
import { decisionsApi } from '../api/client';
import type { Decision, DecisionCategory } from '../api/client';

export default function Decisions() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, abandoned: 0, due_reviews: 0 });
  const [filter, setFilter] = useState('all');
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
  }, [filter, page, selectedCategory]);

  const loadDecisions = async () => {
    setLoading(true);
    const result = await decisionsApi.list({
      status: filter === 'all' ? undefined : filter,
      category_id: selectedCategory ?? undefined,
      page,
      page_size: 20,
    });
    setDecisions(result.items);
    setTotal(result.total);
    setTotalPages(result.total_pages);
    setLoading(false);
  };

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

      <div className="flex gap-6">
        {/* 分类侧栏 */}
        <div className="w-56 shrink-0">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">分类</h3>
              <button
                onClick={() => setShowNewCategory(true)}
                className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                title="新建分类"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            {showNewCategory && (
              <div className="flex items-center gap-1 mb-3">
                <input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="分类名称"
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setShowNewCategory(false); }}
                />
                <button onClick={handleCreateCategory} className="p-1 text-green-500 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setShowNewCategory(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <button
              onClick={() => { setSelectedCategory(null); setPage(1); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                selectedCategory === null
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              全部决策
            </button>

            {categories.map(cat => (
              <div key={cat.id} className="group flex items-center gap-1">
                {editingCategory === cat.id ? (
                  <div className="flex items-center gap-1 flex-1 px-2 py-1">
                    <input
                      value={editCategoryName}
                      onChange={e => setEditCategoryName(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameCategory(cat.id);
                        if (e.key === 'Escape') setEditingCategory(null);
                      }}
                    />
                    <button onClick={() => handleRenameCategory(cat.id)} className="p-1 text-green-500"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingCategory(null)} className="p-1 text-slate-400"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </button>
                )}
                {editingCategory !== cat.id && (
                  <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
                    <button
                      onClick={() => { setEditingCategory(cat.id); setEditCategoryName(cat.name); }}
                      className="p-1 text-slate-400 hover:text-blue-500"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCategory(e, cat.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {categories.length === 0 && !showNewCategory && (
              <p className="text-xs text-slate-400 mt-2 text-center">暂无分类</p>
            )}
          </div>
        </div>

        {/* 决策列表 */}
        <div className="flex-1 min-w-0">
          {/* 筛选 */}
          <div className="flex gap-2 mb-4">
            {['all', 'draft', 'active', 'completed', 'abandoned'].map((f) => (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }}
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
                        {d.category_id && categories.find(c => c.id === d.category_id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 shrink-0">
                            {categories.find(c => c.id === d.category_id)!.name}
                          </span>
                        )}
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

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />上一页
              </button>
              <span className="text-sm text-slate-500">
                第 {page} / {totalPages} 页（共 {total} 条）
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                下一页<ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
