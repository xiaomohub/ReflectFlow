import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, History, Trash2 } from 'lucide-react';
import { decisionsApi, contextsApi } from '../api/client';
import type { Decision, DecisionReview, UserContext } from '../api/client';

export default function DecisionDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [decision, setDecision] = useState<Decision>({
    id: 0, title: '', description: '', context: '', article_id: null,
    related_domains: [], options: [], chosen_option: '', rationale: '',
    ai_advice: '', ai_advice_used: false, status: 'draft', confidence_score: 5,
    review_interval_days: 30, next_review_date: null, last_reviewed_at: null,
    created_at: '', decided_at: null, updated_at: '',
  });
  const [reviews, setReviews] = useState<DecisionReview[]>([]);
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ outcome: '', outcome_score: 5, lessons_learned: '', what_went_well: '', what_to_improve: '', next_steps: '', mood: 'neutral' });
  const [newOption, setNewOption] = useState({ name: '', pros: '', cons: '', score: 5 });

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      const articleId = searchParams.get('article');
      if (articleId) setDecision(d => ({ ...d, article_id: Number(articleId) }));
      contextsApi.list().then(setContexts);
    } else if (id) {
      Promise.all([
        decisionsApi.get(Number(id)),
        decisionsApi.getReviews(Number(id)),
        contextsApi.list(),
      ]).then(([d, r, c]) => {
        setDecision(d);
        setReviews(r);
        setContexts(c);
        setLoading(false);
      });
    }
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    if (isNew) {
      const d = await decisionsApi.create(decision);
      navigate(`/decisions/${d.id}`, { replace: true });
    } else {
      await decisionsApi.update(Number(id), decision);
    }
    setSaving(false);
  };

  const handleAiAdvice = async () => {
    if (!decision.title) { alert('请先输入决策标题'); return; }
    setAdviceLoading(true);
    try {
      const result = await decisionsApi.aiAdvice({
        title: decision.title,
        context: decision.context,
        options: decision.options,
        related_domains: decision.related_domains,
      });
      setDecision(d => ({ ...d, ai_advice: result.advice, rationale: result.analysis }));
    } catch (e) {
      alert('AI 建议获取失败');
    }
    setAdviceLoading(false);
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
    setReviewForm({ outcome: '', outcome_score: 5, lessons_learned: '', what_went_well: '', what_to_improve: '', next_steps: '', mood: 'neutral' });
  };

  const toggleDomain = (domain: string) => {
    setDecision(d => ({
      ...d,
      related_domains: d.related_domains.includes(domain)
        ? d.related_domains.filter(x => x !== domain)
        : [...d.related_domains, domain],
    }));
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => navigate('/decisions')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-500 transition-colors">
        <ArrowLeft className="w-4 h-4" />返回决策列表
      </button>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {isNew ? '新建决策' : '决策详情'}
          </h2>
          <div className="flex gap-3">
            {!isNew && (
              <>
                <button onClick={() => setShowReviewForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-lg text-sm hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-colors">
                  <History className="w-4 h-4" />添加复盘
                </button>
                <button onClick={handleDeleteDecision}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-lg text-sm hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />删除
                </button>
              </>
            )}
            <button onClick={() => navigate('/decisions')}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm transition-colors">取消</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '保存决策'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">标题</label>
            <input value={decision.title} onChange={e => setDecision({ ...decision, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" placeholder="决策标题" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">状态</label>
              <select value={decision.status} onChange={e => setDecision({ ...decision, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm">
                <option value="draft">草稿</option>
                <option value="active">进行中</option>
                <option value="completed">已完成</option>
                <option value="abandoned">已放弃</option>
              </select>
            </div>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">背景 / 触发原因</label>
            <textarea value={decision.context} onChange={e => setDecision({ ...decision, context: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" rows={3} placeholder="是什么促使你做这个决策？" />
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
            {decision.ai_advice && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{decision.ai_advice}</p>
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input type="checkbox" checked={decision.ai_advice_used}
                    onChange={e => setDecision({ ...decision, ai_advice_used: e.target.checked })}
                    className="rounded border-slate-300" />
                  <span className="text-slate-500">采纳了 AI 的建议</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 复盘历史 */}
      {!isNew && reviews.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
            <History className="w-4 h-4" />
            复盘记录 ({reviews.length})
          </h3>
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500">{new Date(r.review_date).toLocaleDateString('zh-CN')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-medium">评分: {r.outcome_score}/10</span>
                    <button onClick={() => handleDeleteReview(r.id)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors" title="删除复盘">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{r.outcome}</p>
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
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-4">添加复盘记录</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">实际结果</label>
                <textarea value={reviewForm.outcome} onChange={e => setReviewForm({ ...reviewForm, outcome: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 text-sm" rows={3} />
              </div>
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
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAddReview} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">保存</button>
              <button onClick={() => setShowReviewForm(false)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
