import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, Sparkles, Eye, Star, GitBranch, Trash2, ChevronLeft, ChevronRight, CheckSquare, Square, Archive, Globe, ExternalLink, AlertTriangle, X } from 'lucide-react';
import { articlesApi, sourcesApi, contextsApi } from '../api/client';
import type { Article, Source, UserContext } from '../api/client';

const ACTION_TABS = [
  { key: 'all', label: '全部' },
  { key: 'read', label: '值得读' },
  { key: 'decide', label: '需决策' },
  { key: 'archive', label: '可存档' },
  { key: 'ignore', label: '忽略' },
  { key: 'read_articles', label: '已读' },
];

export default function Inbox() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [sortBy, setSortBy] = useState('relevance_score');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionTab, setActionTab] = useState('all');
  const [domainFilter, setDomainFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<number | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [domains, setDomains] = useState<UserContext[]>([]);
  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ===== 数据加载 =====
  useEffect(() => {
    contextsApi.list().then(setDomains);
    const sid = searchParams.get('source_id');
    if (sid) {
      const id = parseInt(sid);
      setSourceFilter(id);
      sourcesApi.list().then(sources => {
        const s = sources.find((s: Source) => s.id === id);
        if (s) setSourceName(s.name);
      });
    } else {
      setSourceFilter(null);
      setSourceName('');
    }
  }, [searchParams]);

  useEffect(() => {
    loadArticles();
  }, [sortBy, page, actionTab, domainFilter, sourceFilter]);

  // 切换筛选条件时清除批量选择
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAllMode(false);
  }, [actionTab, domainFilter, sourceFilter]);

  const loadArticles = async () => {
    setLoading(true);
    const statusMap: Record<string, string | undefined> = {
      all: 'all',
      read: 'all',
      decide: 'all',
      archive: 'all',
      ignore: 'all',
      read_articles: 'all',
    };
    const isReadMap: Record<string, boolean | undefined> = {
      read_articles: true,
    };
    const actionMap: Record<string, string | undefined> = {
      read: 'read',
      decide: 'decide',
      archive: 'archive',
      ignore: 'ignore',
    };
    const result = await articlesApi.list({
      sort_by: sortBy,
      page,
      page_size: 20,
      ...(statusMap[actionTab] ? { status: statusMap[actionTab] } : {}),
      ...(isReadMap[actionTab] !== undefined ? { is_read: isReadMap[actionTab] } : {}),
      ...(actionMap[actionTab] ? { suggested_action: actionMap[actionTab] } : {}),
      ...(domainFilter ? { domain: domainFilter } : {}),
      ...(sourceFilter ? { source_id: sourceFilter } : {}),
    });
    setArticles(result.items);
    setTotalPages(result.total_pages);
    setTotal(result.total);
    setLoading(false);
  };

  const handleAiFilter = async () => {
    setFiltering(true);
    await articlesApi.filter();
    loadArticles();
    setFiltering(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这篇文章吗？')) return;
    await articlesApi.delete(id);
    loadArticles();
  };

  const handleAction = async (id: number, action: string) => {
    const updates: Record<string, unknown> = {};
    if (action === 'read') updates.is_read = true;
    if (action === 'archive') { updates.is_read = true; updates.status = 'archived'; }
    if (action === 'decide') { updates.status = 'actioned'; updates.is_read = true; }
    if (action === 'star') { updates.is_starred = true; }
    await articlesApi.update(id, updates);
    loadArticles();
  };

  // ===== 批量操作 =====
  const [selectAllMode, setSelectAllMode] = useState(false);

  const toggleSelect = (id: number) => {
    if (selectAllMode) setSelectAllMode(false);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAllMode) {
      // 已处于跨页全选模式 — 取消全选
      setSelectAllMode(false);
      setSelectedIds(new Set());
    } else if (selectedIds.size === articles.length && selectedIds.size > 0) {
      // 已选中当前页全部 — 切换到跨页全选
      setSelectAllMode(true);
    } else {
      // 选中当前页全部
      setSelectAllMode(false);
      setSelectedIds(new Set(articles.map(a => a.id)));
    }
  };

  const buildBatchFilters = () => ({
    select_all: selectAllMode,
    status: undefined,
    is_read: actionTab === 'read_articles' ? true : undefined,
    suggested_action: (['read', 'decide', 'archive', 'ignore'] as const).includes(actionTab as any)
      ? actionTab
      : undefined,
    domain: domainFilter || undefined,
    source_id: sourceFilter || undefined,
  });

  const handleBatchRead = async () => {
    if (selectedIds.size === 0 && !selectAllMode) return;
    await articlesApi.batchUpdate([...selectedIds], { is_read: true }, buildBatchFilters());
    setSelectedIds(new Set());
    setSelectAllMode(false);
    loadArticles();
  };

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0 && !selectAllMode) return;
    await articlesApi.batchUpdate([...selectedIds], { is_read: true, status: 'archived' }, buildBatchFilters());
    setSelectedIds(new Set());
    setSelectAllMode(false);
    loadArticles();
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0 && !selectAllMode) return;
    const count = selectAllMode ? total : selectedIds.size;
    if (!confirm(`确定要删除选中的 ${count} 篇文章吗？`)) return;
    await articlesApi.batchDelete([...selectedIds], buildBatchFilters());
    setSelectedIds(new Set());
    setSelectAllMode(false);
    loadArticles();
  };

  // ===== 决策关联 =====
  const handleCreateDecision = async (article: Article) => {
    await articlesApi.update(article.id, { status: 'actioned', is_read: true });
    navigate(`/decisions/new?article=${article.id}`);
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

  /** 高亮 relevance_reason 中的关键词 */
  const highlightKeywords = (text: string) => {
    const parts = text.split(/(匹配关键词:|关注领域:|重要人物:)/g);
    if (parts.length <= 1) return text;
    return parts.map((part, i) => {
      if (part === '匹配关键词:' || part === '关注领域:' || part === '重要人物:') {
        return <span key={i} className="text-blue-500 font-medium">{part}</span>;
      }
      return part;
    });
  };

  /** 提取匹配的领域/关键词标签 */
  const getMatchedTags = (article: Article): string[] => {
    const tags: string[] = [];
    if (article.ai_analysis) {
      const analysis = article.ai_analysis as Record<string, unknown>;
      const matched = analysis.matched_domains;
      if (Array.isArray(matched)) {
        matched.forEach((d: unknown) => {
          if (typeof d === 'string') tags.push(d);
        });
      }
    }
    return tags;
  };

  /** 截取 summary 到指定长度 */
  const truncateSummary = (text: string, maxLen = 280) => {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  return (
    <div className="space-y-6">
      {/* 顶栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">信息收件箱</h2>
          <p className="text-slate-500 mt-1">
            {domainFilter
              ? `关注领域：${domainFilter}`
              : '按关注领域筛选，快速浏览高价值信息'}
            {total > 0 && <span className="text-xs ml-1">（共 {total} 篇）</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); setSelectAllMode(false); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
              batchMode
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {batchMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            批量操作
          </button>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
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

      {/* ===== 关注领域导航 — 主筛选 ===== */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">关注领域</span>
          {domainFilter && (
            <button
              onClick={() => { setDomainFilter(''); setPage(1); }}
              className="ml-auto text-xs px-2 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 transition-colors"
            >
              清除筛选
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {domains.map(d => {
            const isActive = domainFilter === d.domain;
            const colors = [
              'from-blue-50 to-sky-50 border-blue-200/70 text-blue-700 dark:from-blue-900/20 dark:to-sky-900/20 dark:border-blue-800 dark:text-blue-300',
              'from-emerald-50 to-teal-50 border-emerald-200/70 text-emerald-700 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-800 dark:text-emerald-300',
              'from-purple-50 to-violet-50 border-purple-200/70 text-purple-700 dark:from-purple-900/20 dark:to-violet-900/20 dark:border-purple-800 dark:text-purple-300',
              'from-amber-50 to-orange-50 border-amber-200/70 text-amber-700 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-800 dark:text-amber-300',
              'from-rose-50 to-pink-50 border-rose-200/70 text-rose-700 dark:from-rose-900/20 dark:to-pink-900/20 dark:border-rose-800 dark:text-rose-300',
              'from-cyan-50 to-sky-50 border-cyan-200/70 text-cyan-700 dark:from-cyan-900/20 dark:to-sky-900/20 dark:border-cyan-800 dark:text-cyan-300',
              'from-orange-50 to-amber-50 border-orange-200/70 text-orange-700 dark:from-orange-900/20 dark:to-amber-900/20 dark:border-orange-800 dark:text-orange-300',
              'from-teal-50 to-cyan-50 border-teal-200/70 text-teal-700 dark:from-teal-900/20 dark:to-cyan-900/20 dark:border-teal-800 dark:text-teal-300',
            ];
            const colorIdx = d.id % colors.length;
            return (
              <button
                key={d.id}
                onClick={() => { setDomainFilter(isActive ? '' : d.domain); setPage(1); }}
                className={`group text-left rounded-xl border p-3.5 bg-gradient-to-br transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-500 shadow-[0_8px_24px_rgba(37,99,235,0.35)] -translate-y-0.5'
                    : `${colors[colorIdx]} hover:shadow-[0_10px_26px_rgba(15,23,42,0.10)] hover:-translate-y-1`
                }`}
                title={d.description}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm leading-5 truncate">{d.domain}</p>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-white/70 dark:bg-slate-900/30'
                  }`}>
                    P{d.priority}
                  </span>
                </div>
                <p className={`mt-1 text-xs leading-5 max-h-10 overflow-hidden ${
                  isActive ? 'text-blue-50/95' : 'opacity-80 group-hover:opacity-100'
                }`}>
                  {d.current_focus || d.description || '点击按该领域筛选文章'}
                </p>
              </button>
            );
          })}
          {domains.length === 0 && (
            <p className="text-sm text-slate-400">暂无关注领域，请先在"领域上下文"中设置</p>
          )}
        </div>
      </div>

      {/* 来源筛选指示 */}
      {sourceFilter && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
          <Filter className="w-4 h-4" />
          当前信息源：<strong>{sourceName || `#${sourceFilter}`}</strong>
          <button
            onClick={() => navigate('/inbox')}
            className="ml-2 text-xs px-2 py-0.5 bg-blue-200 dark:bg-blue-800 rounded hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
          >
            清除
          </button>
        </div>
      )}

      {/* 批量操作栏 */}
      {batchMode && (
        <div className="space-y-2">
          {/* 跨页全选提示横幅 */}
          {selectAllMode && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>已跨页全选 <strong>全部 {total} 篇</strong> 文章，操作将应用于当前筛选条件下的所有文章</span>
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-800 font-medium shrink-0">
              {selectAllMode ? <X className="w-4 h-4" /> : selectedIds.size === articles.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectAllMode ? '取消全选' : selectedIds.size === articles.length && articles.length > 0 ? '全选全部页' : '全选当前页'}
            </button>
            <span className="text-sm text-blue-600 dark:text-blue-400 shrink-0">
              {selectAllMode
                ? `已选 ${total} 篇`
                : selectedIds.size > 0
                  ? `已选 ${selectedIds.size} 篇（点击「全选全部页」选择全部 ${total} 篇）`
                  : '请选择文章'
              }
            </span>
            <div className="flex-1" />
            <button
              onClick={handleBatchRead}
              disabled={!selectAllMode && selectedIds.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Eye className="w-3 h-3" />批量已读
            </button>
            <button
              onClick={handleBatchArchive}
              disabled={!selectAllMode && selectedIds.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-500 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              <Archive className="w-3 h-3" />批量存档
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={!selectAllMode && selectedIds.size === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3 h-3" />批量删除
            </button>
          </div>
        </div>
      )}

      {/* 操作类型 Tab */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        {ACTION_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActionTab(tab.key); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              actionTab === tab.key
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 文章列表 */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
      ) : (
        <>
          <div className="space-y-3">
            {articles.map((a) => {
              const tags = getMatchedTags(a);
              return (
              <div key={a.id} className={`bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border transition-shadow ${
                selectedIds.has(a.id)
                  ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                  : 'border-slate-200 dark:border-slate-700 hover:shadow-md'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  {/* 批量选择框 */}
                  {batchMode && (
                    <button onClick={() => toggleSelect(a.id)} className="mt-1 shrink-0">
                      {selectedIds.has(a.id)
                        ? <CheckSquare className="w-5 h-5 text-blue-500" />
                        : <Square className="w-5 h-5 text-slate-300" />
                      }
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    {/* 标题行 */}
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-slate-800 dark:text-white truncate">{a.title}</h3>
                      {a.is_starred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 shrink-0" />}
                    </div>
                    {/* 元信息 */}
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                      {a.author && <span>{a.author}</span>}
                      <span>{new Date(a.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    {/* 内容摘要 — 核心信息，用于快速判断 */}
                    {a.summary && (
                      <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3 mb-2 border border-slate-100 dark:border-slate-600">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {truncateSummary(a.summary, 400)}
                        </p>
                      </div>
                    )}
                    {/* AI 相关性理由 */}
                    {a.relevance_reason && !a.summary && (
                      <p className="text-sm text-slate-500 mt-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                        {highlightKeywords(a.relevance_reason)}
                      </p>
                    )}
                    {/* 匹配领域标签 */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.map(tag => (
                          <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-full font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 右侧评分和操作 */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded ${
                      a.relevance_score >= 0.7 ? 'bg-green-100 text-green-700' :
                      a.relevance_score >= 0.4 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {(a.relevance_score * 100).toFixed(0)}%
                    </span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getActionColor(a.suggested_action)}`}>
                      {a.suggested_action === 'decide' ? '需决策' : a.suggested_action === 'read' ? '值得读' : a.suggested_action === 'archive' ? '可存档' : '忽略'}
                    </span>
                  </div>
                </div>
                {/* 操作按钮 */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  {!batchMode && (
                    <>
                      <button onClick={() => handleAction(a.id, 'read')}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors">
                        <Eye className="w-3 h-3" />标记已读
                      </button>
                      <button onClick={() => handleCreateDecision(a)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 transition-colors">
                        <GitBranch className="w-3 h-3" />创建决策
                      </button>
                    </>
                  )}
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-blue-500 transition-colors">
                      <ExternalLink className="w-3 h-3" />查看原文
                    </a>
                  )}
                  {!batchMode && (
                    <button onClick={() => handleDelete(a.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-auto">
                      <Trash2 className="w-3 h-3" />删除
                    </button>
                  )}
                </div>
              </div>
            )})}
            {articles.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>
                  {domainFilter
                    ? `"${domainFilter}" 领域暂无匹配文章`
                    : '收件箱空空如也'}
                </p>
                <p className="text-sm mt-1">
                  {domainFilter
                    ? '试试切换到其他领域，或先使用 AI 过滤'
                    : '先去信息源页面拉取信息，然后点击 AI 过滤'}
                </p>
              </div>
            )}
          </div>

          {/* 分页 — 带页码按钮和跳转 */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-3 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  title="第一页"
                >
                  ≪
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* 页码按钮 — 显示当前页附近的页码 */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    // 显示当前页附近的页码
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else {
                      const half = 3;
                      let start = Math.max(1, page - half);
                      const end = Math.min(totalPages, start + 6);
                      if (end - start < 6) start = Math.max(1, end - 6);
                      pageNum = start + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-9 h-9 text-sm rounded-lg border transition-all font-medium ${
                          page === pageNum
                            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  title="最后一页"
                >
                  ≫
                </button>
              </div>

              {/* 跳转输入 */}
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>第</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    if (v >= 1 && v <= totalPages) setPage(v);
                  }}
                  className="w-16 px-2 py-1 text-center border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
                />
                <span>/ {totalPages} 页</span>
                <span className="text-slate-400 ml-1">(共 {total} 篇)</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
