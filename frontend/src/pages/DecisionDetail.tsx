import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, History, Trash2, Clock, GitCommit, FileText, RefreshCw, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { decisionsApi, contextsApi, skillsApi, notesApi } from '../api/client';
import type { Decision, DecisionReview, DecisionChangeLog, UserContext, DecisionCategory, PersonaAnalysis, PersonaInfo, Note, AIAdviceResponse } from '../api/client';

export default function DecisionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [decision, setDecision] = useState<Decision>({
    id: 0, title: '', description: '', context: '', original_context: '', environment_snapshot: {},
    article_id: null, category_id: null, related_domains: [], options: [], chosen_option: '', rationale: '',
    ai_advice: '', ai_advice_used: false, status: 'draft', confidence_score: 5,
    review_interval_days: 30, next_review_date: null, last_reviewed_at: null,
    created_at: '', decided_at: null, updated_at: '',
  });
  const [reviews, setReviews] = useState<DecisionReview[]>([]);
  const [changeLog, setChangeLog] = useState<DecisionChangeLog[]>([]);
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [categories, setCategories] = useState<DecisionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsResults, setSkillsResults] = useState<PersonaAnalysis[]>([]);
  const [personasList, setPersonasList] = useState<PersonaInfo[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    outcome: '', outcome_score: 5, lessons_learned: '',
    what_went_well: '', what_to_improve: '', next_steps: '', mood: 'neutral',
    progress: '', adjusted_plan: '', is_progress_update: false,
  });
  const [decisionNotes, setDecisionNotes] = useState<Note[]>([]);
  const [changeReason, setChangeReason] = useState('');
  const [newOption, setNewOption] = useState({ name: '', pros: '', cons: '', score: 5 });
  const [aiAdviceResult, setAiAdviceResult] = useState<AIAdviceResponse | null>(null);
  const [previousDecision, setPreviousDecision] = useState<Decision | null>(null);
  const [nextDecisions, setNextDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      decisionsApi.get(Number(id)),
      decisionsApi.getReviews(Number(id)),
      decisionsApi.getChangeLog(Number(id)),
      contextsApi.list(),
      decisionsApi.listCategories(),
      notesApi.byDecision(Number(id)),
    ]).then(([d, r, c, ctx, cats, notes]) => {
      setDecision(d);
      setReviews(r);
      setChangeLog(c);
      setContexts(ctx);
      setCategories(cats);
      setDecisionNotes(notes);
      if (d.parent_decision_id) {
        decisionsApi.get(d.parent_decision_id).then(p => setPreviousDecision(p));
      }
      decisionsApi.getChildren(Number(id)).then(children => setNextDecisions(children));
      setLoading(false);
    });
  }, [id]);

  const handleSave = async (statusOverride?: string) => {
    setSaving(true);
    const updateData: Record<string, unknown> = {
      title: decision.title,
      description: decision.description,
      context: decision.context,
      category_id: decision.category_id,
      related_domains: decision.related_domains,
      options: decision.options,
      chosen_option: decision.chosen_option,
      rationale: decision.rationale,
      ai_advice: decision.ai_advice,
      ai_advice_used: decision.ai_advice_used,
      status: statusOverride || decision.status,
      confidence_score: decision.confidence_score,
      review_interval_days: decision.review_interval_days,
    };
    if (changeReason) updateData.change_reason = changeReason;
    try {
      const updated = await decisionsApi.update(Number(id), updateData as Partial<Decision>);
      setDecision(prev => ({ ...prev, ...updated }));
      setChangeReason('');
      const log = await decisionsApi.getChangeLog(Number(id));
      setChangeLog(log);
    } catch (e) {
      alert('保存失败: ' + (e instanceof Error ? e.message : '未知错误'));
    }
    setSaving(false);
  };

  const handleAiAdvice = async () => {
    if (!decision.title) { alert('请先输入决策标题'); return; }
    setAdviceLoading(true);
    try {
      const previousIds: number[] = [];
      if (decision.parent_decision_id) {
        previousIds.push(decision.parent_decision_id);
      }
      const result = await decisionsApi.aiAdvice({
        title: decision.title,
        context: decision.context,
        options: decision.options,
        related_domains: decision.related_domains,
        previous_decision_ids: previousIds,
      });
      setAiAdviceResult(result);
      setDecision(d => ({ ...d, ai_advice: result.advice, rationale: result.analysis }));
    } catch (e) {
      alert('AI 建议获取失败');
    }
    setAdviceLoading(false);
  };

  const handleSkillsAnalysis = async () => {
    if (!decision.title) { alert('请先输入决策标题'); return; }
    setSkillsLoading(true);
    try {
      // 首次打开时加载人物列表
      if (personasList.length === 0) {
        const list = await skillsApi.listPersonas();
        setPersonasList(list);
      }
      const result = await skillsApi.analyze({
        decision_id: Number(id),
        title: decision.title,
        context: decision.context,
        options: decision.options,
        persona_ids: selectedPersonas,
      });
      setSkillsResults(result.analyses);
      setSkillsOpen(true);
      if (result.analyses.length > 0) {
        setExpandedAnalysis(result.analyses[0].persona_id);
      }
    } catch (e) {
      alert('人格分析获取失败');
    }
    setSkillsLoading(false);
  };

  const handleAddOption = () => {
    if (!newOption.name) return;
    setDecision(d => ({
      ...d,
      options: [...d.options, {
        name: newOption.name,
        pros: newOption.pros.split('\n').filter(Boolean),
        cons: newOption.cons.split('\n').filter(Boolean),
        score: newOption.score,
      }],
    }));
    setNewOption({ name: '', pros: '', cons: '', score: 5 });
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm('确定要删除这条复盘记录吗？')) return;
    await decisionsApi.deleteReview(Number(id), reviewId);
    const r = await decisionsApi.getReviews(Number(id));
    setReviews(r);
  };

  const handleDeleteDecision = async () => {
    if (!confirm('确定要删除这个决策吗？关联的复盘记录也会被删除。此操作不可撤销。')) return;
    await decisionsApi.delete(Number(id));
    navigate('/decisions');
  };

  const handleAddReview = async () => {
    await decisionsApi.addReview(Number(id), reviewForm);
    setShowReviewForm(false);
    const r = await decisionsApi.getReviews(Number(id));
    setReviews(r);
    setReviewForm({ outcome: '', outcome_score: 5, lessons_learned: '', what_went_well: '', what_to_improve: '', next_steps: '', mood: 'neutral', progress: '', adjusted_plan: '', is_progress_update: false });
  };

  const toggleDomain = (domain: string) => {
    setDecision(d => ({
      ...d,
      related_domains: d.related_domains.includes(domain)
        ? d.related_domains.filter(x => x !== domain)
        : [...d.related_domains, domain],
    }));
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      abandoned: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    };
    return map[status] || map.draft;
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = { draft: '草稿', active: '进行中', completed: '已完成', abandoned: '已放弃' };
    return map[status] || status;
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => navigate('/decisions')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-500 transition-colors">
        <ArrowLeft className="w-4 h-4" />返回决策列表
      </button>

      {/* 主编辑区 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              决策详情
            </h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadge(decision.status)}`}>
                {getStatusLabel(decision.status)}
              </span>
          </div>
          <div className="flex gap-3">
              <button onClick={() => setShowChangeLog(!showChangeLog)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <GitCommit className="w-4 h-4" />变更历史
              </button>
              <button onClick={() => setShowSnapshot(!showSnapshot)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 transition-colors">
                <FileText className="w-4 h-4" />环境快照
              </button>
              <button onClick={() => setShowReviewForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-lg text-sm hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-colors">
                <History className="w-4 h-4" />添加复盘
              </button>
              <button onClick={handleDeleteDecision}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-lg text-sm hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />删除
              </button>
              <button onClick={() => navigate(`/decisions/new?parent_id=${id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-sm hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors">
                <Plus className="w-4 h-4" />新建决策
              </button>
            <button onClick={() => navigate('/decisions')}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm transition-colors">取消</button>
            <button onClick={() => handleSave()} disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '保存决策'}
            </button>
          </div>
        </div>

        {/* 变更原因输入 */}
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-lg">
            <label className="block text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">变更原因说明（可选，记录本次修改的原因）</label>
            <input value={changeReason} onChange={e => setChangeReason(e.target.value)}
              className="w-full px-3 py-1.5 border border-amber-200 dark:border-amber-700/50 rounded bg-white dark:bg-slate-700 text-sm"
              placeholder="如：调整仓位、市场环境变化、新增信息..." />
          </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">标题</label>
            <input value={decision.title} onChange={e => setDecision({ ...decision, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" placeholder="决策标题" />
          </div>

          {/* 状态机可视化 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">状态流转</label>
            <div className="flex items-center gap-0">
              {[
                { key: 'draft', label: '草稿', icon: '📝', color: 'slate' },
                { key: 'active', label: '进行中', icon: '⚡', color: 'green' },
                { key: 'completed', label: '已完成', icon: '✅', color: 'blue' },
                { key: 'abandoned', label: '已放弃', icon: '🔄', color: 'red' },
              ].map((state, i) => {
                const isCurrent = decision.status === state.key;
                const colorMap: Record<string, string> = {
                  slate: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', activeBg: 'bg-slate-500', activeText: 'text-white' },
                  green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-300', activeBg: 'bg-green-500', activeText: 'text-white' },
                  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-300', activeBg: 'bg-blue-500', activeText: 'text-white' },
                  red: { bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-300', activeBg: 'bg-red-400', activeText: 'text-white' },
                };
                const c = colorMap[state.color];
                return (
                  <div key={state.key} className="flex items-center">
                    <div className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border ${
                      isCurrent
                        ? `${c.activeBg} ${c.activeText} border-transparent shadow-sm`
                        : `${c.bg} ${c.text} ${c.border}`
                    }`}>
                      <span>{state.icon}</span>
                      <span>{state.label}</span>
                    </div>
                    {i < 3 && (
                      <div className="w-4 h-px bg-slate-300 dark:bg-slate-600" />
                    )}
                  </div>
                );
              })}
            </div>
            {/* 状态变更按钮 */}
            <div className="flex items-center gap-2 mt-2">
              {(() => {
                const actions: Record<string, Array<{ to: string; label: string; color: string; confirm?: string }>> = {
                  draft: [{ to: 'active', label: '开始执行', color: 'green', confirm: '确定开始执行这个决策吗？' }],
                  active: [
                    { to: 'completed', label: '标记完成', color: 'blue', confirm: '确认已完成此决策？' },
                    { to: 'abandoned', label: '放弃决策', color: 'red', confirm: '确定要放弃这个决策吗？' },
                  ],
                  completed: [{ to: 'active', label: '重新打开', color: 'green', confirm: '重新打开此决策？' }],
                  abandoned: [{ to: 'active', label: '重新打开', color: 'green', confirm: '重新打开此决策？' }],
                };
                const currentActions = actions[decision.status] || [];
                return currentActions.map(action => (
                  <button
                    key={action.to}
                    onClick={() => {
                      if (!action.confirm || confirm(action.confirm)) {
                        setDecision({ ...decision, status: action.to });
                      }
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      action.color === 'green'
                        ? 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                        : action.color === 'blue'
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                    }`}
                  >
                    {action.label}
                  </button>
                ));
              })()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">信心指数 (1-10)</label>
              <input type="number" min={1} max={10} value={decision.confidence_score}
                onChange={e => setDecision({ ...decision, confidence_score: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">复盘周期 (天)</label>
              <input type="number" min={1} value={decision.review_interval_days}
                onChange={e => setDecision({ ...decision, review_interval_days: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">分类</label>
              <select value={decision.category_id ?? ''} onChange={e => setDecision({ ...decision, category_id: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm">
                <option value="">未分类</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">背景 / 触发原因</label>
              <textarea value={decision.context} onChange={e => setDecision({ ...decision, context: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" rows={3} placeholder="是什么促使你做这个决策？" />
              {decision.original_context && decision.context !== decision.original_context && (
                <p className="text-xs text-amber-500 mt-1">已修改，原始背景保存在环境快照中</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">关联领域</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {contexts.map(c => (
                  <button key={c.id} onClick={() => toggleDomain(c.domain)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      decision.related_domains.includes(c.domain)
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 hover:bg-slate-200'
                    }`}>{c.domain}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 选项区域 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">考虑选项</label>
            <div className="space-y-3">
              {decision.options.map((opt, i) => (
                <div key={i} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{opt.name}</span>
                    <span className="text-sm text-slate-400">自评: {opt.score}/10</span>
                  </div>
                  {opt.pros.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs text-green-600 font-medium">优点:</span>
                      <p className="text-xs text-slate-500">{opt.pros.join('、')}</p>
                    </div>
                  )}
                  {opt.cons.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs text-red-500 font-medium">缺点:</span>
                      <p className="text-xs text-slate-500">{opt.cons.join('、')}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* 添加选项 */}
            <div className="mt-3 p-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
              <p className="text-xs font-medium text-slate-500 mb-2">添加选项</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={newOption.name} onChange={e => setNewOption({ ...newOption, name: e.target.value })}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm" placeholder="选项名称" />
                <input type="number" min={1} max={10} value={newOption.score}
                  onChange={e => setNewOption({ ...newOption, score: Number(e.target.value) })}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm" placeholder="评分" />
                <textarea value={newOption.pros} onChange={e => setNewOption({ ...newOption, pros: e.target.value })}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm" rows={2} placeholder="优点（每行一个）" />
                <textarea value={newOption.cons} onChange={e => setNewOption({ ...newOption, cons: e.target.value })}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-sm" rows={2} placeholder="缺点（每行一个）" />
              </div>
              <button onClick={handleAddOption}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <Plus className="w-3 h-3" />添加选项
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">最终选择</label>
            <select value={decision.chosen_option} onChange={e => setDecision({ ...decision, chosen_option: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm">
              <option value="">-- 请选择 --</option>
              {decision.options.map((opt, i) => (
                <option key={i} value={opt.name}>{opt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">决策理由</label>
            <textarea value={decision.rationale} onChange={e => setDecision({ ...decision, rationale: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" rows={4} placeholder="你为什么做这个选择？" />
          </div>

          {/* 关联决策链 */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">关联决策链</label>
              <button onClick={() => navigate(`/decisions/new?parent_id=${id}`)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors">
                <Plus className="w-3.5 h-3.5" />新建后续决策
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* 前一个决策 */}
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs font-medium text-slate-400 mb-2">前一个决策</p>
                {previousDecision ? (
                  <div onClick={() => navigate(`/decisions/${previousDecision.id}`)}
                    className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors -m-1 p-1 rounded">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{previousDecision.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(previousDecision.created_at).toLocaleDateString('zh-CN')}</p>
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 ${getStatusBadge(previousDecision.status)}`}>{getStatusLabel(previousDecision.status)}</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">— 无 —</p>
                )}
              </div>
              {/* 后一个决策 */}
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs font-medium text-slate-400 mb-2">后一个决策</p>
                {nextDecisions.length > 0 ? (
                  <div className="space-y-2">
                    {nextDecisions.map(child => (
                      <div key={child.id} onClick={() => navigate(`/decisions/${child.id}`)}
                        className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors -m-1 p-1 rounded">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{child.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(child.created_at).toLocaleDateString('zh-CN')}</p>
                        <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 ${getStatusBadge(child.status)}`}>{getStatusLabel(child.status)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2">— 无 —</p>
                )}
              </div>
            </div>
          </div>

          {/* AI 建议 */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">AI 决策建议</label>
              <button onClick={handleAiAdvice} disabled={adviceLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 disabled:opacity-50 transition-colors">
                <Sparkles className={`w-3 h-3 ${adviceLoading ? 'animate-spin' : ''}`} />
                {adviceLoading ? '分析中...' : '获取 AI 建议'}
              </button>
            </div>
            {aiAdviceResult && (
              <div className="space-y-3">
                {/* 推荐选项 */}
                {aiAdviceResult.recommended_option && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700/30 rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <span className="text-green-600 dark:text-green-400 text-sm font-bold">★</span>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">推荐选项</p>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">{aiAdviceResult.recommended_option}</p>
                    </div>
                  </div>
                )}

                {/* 核心建议 */}
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">建议</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{aiAdviceResult.advice}</p>
                </div>

                {/* 详细分析 */}
                {aiAdviceResult.analysis && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">分析</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{aiAdviceResult.analysis}</p>
                  </div>
                )}

                {/* 风险提示 */}
                {aiAdviceResult.risk_warnings.length > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/30 rounded-lg">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">风险提示</p>
                    <ul className="space-y-1">
                      {aiAdviceResult.risk_warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-300">
                          <span className="text-red-400 mt-0.5 shrink-0">•</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={decision.ai_advice_used}
                    onChange={e => setDecision({ ...decision, ai_advice_used: e.target.checked })}
                    className="rounded border-slate-300" />
                  <span className="text-slate-500">采纳了 AI 的建议</span>
                </label>
              </div>
            )}
          </div>

          {/* 人格 Skills 多视角分析 */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-500" />
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  人格 Skills 多视角分析
                </label>
                <span className="text-xs text-slate-400">（巴菲特/芒格/达利欧等视角）</span>
              </div>
              <button
                onClick={handleSkillsAnalysis}
                disabled={skillsLoading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 disabled:opacity-50 transition-colors"
              >
                <Sparkles className={`w-3 h-3 ${skillsLoading ? 'animate-spin' : ''}`} />
                {skillsLoading ? '分析中...' : '多视角分析'}
              </button>
            </div>

            {/* 人物快速选择 */}
            {personasList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {personasList.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPersonas(prev =>
                      prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                    )}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      selectedPersonas.includes(p.id) || selectedPersonas.length === 0
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    {p.emoji} {p.name}
                  </button>
                ))}
                {selectedPersonas.length > 0 && (
                  <button
                    onClick={() => setSelectedPersonas([])}
                    className="px-2 py-0.5 rounded text-xs text-slate-400 hover:text-slate-600"
                  >
                    清除选择
                  </button>
                )}
                <span className="text-xs text-slate-400 ml-1 self-center">
                  {selectedPersonas.length === 0 ? '(默认全部)' : `(${selectedPersonas.length} 个)`}
                </span>
              </div>
            )}

            {/* 分析结果 */}
            {skillsOpen && skillsResults.length > 0 && (
              <div className="space-y-3">
                {skillsResults.map((result) => (
                  <div key={result.persona_id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button
                      onClick={() => setExpandedAnalysis(
                        expandedAnalysis === result.persona_id ? null : result.persona_id
                      )}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{result.emoji}</span>
                        <div className="text-left">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {result.persona_name}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">{result.persona_style}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          result.confidence >= 7 ? 'bg-green-100 text-green-700' :
                          result.confidence >= 4 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          信心指数: {result.confidence}/10
                        </span>
                        {expandedAnalysis === result.persona_id
                          ? <ChevronUp className="w-4 h-4 text-slate-400" />
                          : <ChevronDown className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                    </button>

                    {expandedAnalysis === result.persona_id && (
                      <div className="p-4 space-y-4">
                        {/* 核心建议 */}
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                          <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                            💡 {result.advice}
                          </p>
                        </div>

                        {/* 详细分析 */}
                        <div>
                          <h4 className="text-xs font-medium text-slate-500 mb-2">详细分析</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {result.analysis}
                          </p>
                        </div>

                        {/* 关键问题 */}
                        {result.key_questions.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-slate-500 mb-2">🤔 关键问题</h4>
                            <ul className="space-y-1">
                              {result.key_questions.map((q, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                  <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                                  {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* 风险提示 */}
                        {result.risk_warnings.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-red-500 mb-2">⚠️ 风险提示</h4>
                            <ul className="space-y-1">
                              {result.risk_warnings.map((w, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                  <span className="text-red-400 mt-0.5 shrink-0">•</span>
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 空状态 */}
            {skillsOpen && skillsResults.length === 0 && !skillsLoading && (
              <div className="p-6 text-center">
                <Brain className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">点击「多视角分析」获取巴菲特、芒格等人的决策建议</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 相关笔记 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              相关笔记 ({decisionNotes.length})
            </h3>
            <button
              onClick={() => navigate(`/notes/new?decision_id=${id}`)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />新建笔记
            </button>
          </div>
          {decisionNotes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">暂无相关笔记</p>
          ) : (
            <div className="space-y-2">
              {decisionNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => navigate(`/notes/${note.id}`)}
                  className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{note.title}</span>
                    <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                  {note.snippet && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{note.snippet}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {note.tags?.map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* 环境快照面板 */}
      {showSnapshot && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-indigo-500" />
            决策环境快照
            <span className="text-xs font-normal text-slate-400 ml-1">（创建时保存，不可变）</span>
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 原始背景
              </h4>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                {decision.original_context || '无记录'}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> 当前背景
              </h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                {decision.context || '无记录'}
              </div>
            </div>
          </div>
          {Object.keys(decision.environment_snapshot).length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-medium text-slate-500 mb-2">环境元数据</h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <pre className="text-xs text-slate-500 whitespace-pre-wrap">
                  {JSON.stringify(decision.environment_snapshot, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 变更历史面板 */}
      {showChangeLog && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
            <GitCommit className="w-4 h-4 text-amber-500" />
            变更历史（{changeLog.length} 条）
          </h3>
          {changeLog.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">暂无变更记录</p>
          ) : (
            <div className="space-y-3">
              {changeLog.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{new Date(log.changed_at).toLocaleString('zh-CN')}</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">{log.field_name}</span>
                    </div>
                    <div className="mt-1 text-sm">
                      {log.old_value && (
                        <span className="text-red-500 line-through mr-2">{log.old_value}</span>
                      )}
                      <span className="text-green-600">{log.new_value}</span>
                    </div>
                    {log.change_reason && (
                      <p className="text-xs text-slate-400 mt-1">原因: {log.change_reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 复盘历史 */}
      {reviews.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
            <History className="w-4 h-4" />
            复盘记录 ({reviews.length})
          </h3>
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{new Date(r.review_date).toLocaleDateString('zh-CN')}</span>
                    {r.is_progress_update && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded">进展更新</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-medium">评分: {r.outcome_score}/10</span>
                    <button onClick={() => handleDeleteReview(r.id)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors" title="删除复盘">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{r.outcome}</p>
                {r.progress && (
                  <p className="text-sm text-slate-500 mt-2"><span className="font-medium text-blue-600">进展:</span> {r.progress}</p>
                )}
                {r.adjusted_plan && (
                  <p className="text-sm text-slate-500 mt-1"><span className="font-medium text-amber-600">调整计划:</span> {r.adjusted_plan}</p>
                )}
                {r.lessons_learned && (
                  <p className="text-sm text-slate-500 mt-2"><span className="font-medium">教训:</span> {r.lessons_learned}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 复盘表单弹窗 */}
      {showReviewForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReviewForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-4">
              {reviewForm.is_progress_update ? '添加进展更新' : '添加复盘记录'}
            </h3>
            <div className="space-y-3">
              {/* 进展更新开关 */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={reviewForm.is_progress_update}
                  onChange={e => setReviewForm({ ...reviewForm, is_progress_update: e.target.checked })}
                  className="rounded border-slate-300" />
                <span className="text-slate-600 dark:text-slate-400">
                  这是进展更新（决策仍在进行中，非最终结论）
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {reviewForm.is_progress_update ? '当前进展' : '实际结果'}
                </label>
                <textarea value={reviewForm.outcome} onChange={e => setReviewForm({ ...reviewForm, outcome: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={2}
                  placeholder={reviewForm.is_progress_update ? '目前的执行情况如何？' : '决策的实际结果如何？'} />
              </div>

              {/* 进展说明（进展更新时显示） */}
              {reviewForm.is_progress_update && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">详细进展说明</label>
                  <textarea value={reviewForm.progress} onChange={e => setReviewForm({ ...reviewForm, progress: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={2}
                    placeholder="对比预期目标，目前进展如何？遇到了什么情况？" />
                </div>
              )}

              {/* 调整计划（进展更新时显示） */}
              {reviewForm.is_progress_update && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">调整计划</label>
                  <textarea value={reviewForm.adjusted_plan} onChange={e => setReviewForm({ ...reviewForm, adjusted_plan: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={2}
                    placeholder="基于当前进展，下一步计划如何调整？" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">结果评分 (1-10)</label>
                  <input type="number" min={1} max={10} value={reviewForm.outcome_score}
                    onChange={e => setReviewForm({ ...reviewForm, outcome_score: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">心情</label>
                  <select value={reviewForm.mood} onChange={e => setReviewForm({ ...reviewForm, mood: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm">
                    <option value="great">很满意</option>
                    <option value="good">满意</option>
                    <option value="neutral">一般</option>
                    <option value="bad">不满意</option>
                    <option value="terrible">很失望</option>
                  </select>
                </div>
              </div>

              {/* 非进展更新时的额外字段 */}
              {!reviewForm.is_progress_update && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">经验教训</label>
                    <textarea value={reviewForm.lessons_learned} onChange={e => setReviewForm({ ...reviewForm, lessons_learned: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">后续行动</label>
                    <textarea value={reviewForm.next_steps} onChange={e => setReviewForm({ ...reviewForm, next_steps: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={2} />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAddReview}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                {reviewForm.is_progress_update ? '保存进展' : '保存复盘'}
              </button>
              <button onClick={() => setShowReviewForm(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
