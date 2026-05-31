import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus } from 'lucide-react';
import { decisionsApi, contextsApi } from '../api/client';
import type { Decision, UserContext, DecisionCategory, DecisionOption, AIAdviceResponse } from '../api/client';

export default function NewDecision() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parent_id');

  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [options, setOptions] = useState<DecisionOption[]>([]);
  const [chosenOption, setChosenOption] = useState('');
  const [rationale, setRationale] = useState('');
  const [confidenceScore, setConfidenceScore] = useState(5);
  const [reviewIntervalDays, setReviewIntervalDays] = useState(30);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [relatedDomains, setRelatedDomains] = useState<string[]>([]);
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [categories, setCategories] = useState<DecisionCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [aiAdviceResult, setAiAdviceResult] = useState<AIAdviceResponse | null>(null);
  const [newOption, setNewOption] = useState({ name: '', pros: '', cons: '', score: 5 });

  useEffect(() => {
    Promise.all([
      contextsApi.list(),
      decisionsApi.listCategories(),
    ]).then(([ctx, cats]) => {
      setContexts(ctx);
      setCategories(cats);
    });
  }, []);

  const toggleDomain = (domain: string) => {
    setRelatedDomains(prev =>
      prev.includes(domain) ? prev.filter(x => x !== domain) : [...prev, domain]
    );
  };

  const handleAddOption = () => {
    if (!newOption.name) return;
    setOptions([...options, {
      name: newOption.name,
      pros: newOption.pros.split('\n').filter(Boolean),
      cons: newOption.cons.split('\n').filter(Boolean),
      score: newOption.score,
    }]);
    setNewOption({ name: '', pros: '', cons: '', score: 5 });
  };

  const handleSave = async () => {
    if (!title.trim()) { alert('请输入决策标题'); return; }
    setSaving(true);
    const d = await decisionsApi.create({
      title: title.trim(),
      context,
      original_context: context,
      environment_snapshot: { created_at: new Date().toISOString() },
      options,
      chosen_option: chosenOption,
      rationale,
      confidence_score: confidenceScore,
      review_interval_days: reviewIntervalDays,
      category_id: categoryId,
      related_domains: relatedDomains,
      status: 'draft',
      ai_advice: aiAdviceResult?.advice || '',
      ai_advice_used: false,
      parent_decision_id: parentId ? Number(parentId) : null,
    } as Partial<Decision>);
    navigate(`/decisions/${d.id}`, { replace: true });
  };

  const handleAiAdvice = async () => {
    if (!title.trim()) { alert('请先输入决策标题'); return; }
    setAdviceLoading(true);
    try {
      const result = await decisionsApi.aiAdvice({
        title,
        context,
        options,
        related_domains: relatedDomains,
      });
      setAiAdviceResult(result);
    } catch (e) {
      alert('AI 建议获取失败');
    }
    setAdviceLoading(false);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => navigate('/decisions')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-500 transition-colors">
        <ArrowLeft className="w-4 h-4" />返回决策列表
      </button>

      {/* 主编辑区 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">新建决策</h2>
          <div className="flex gap-3">
            <button onClick={() => navigate('/decisions')}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm transition-colors">取消</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {saving ? '保存中...' : '创建决策'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">标题</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" placeholder="决策标题" autoFocus />
          </div>

          {/* 三列设置 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">信心指数 (1-10)</label>
              <input type="number" min={1} max={10} value={confidenceScore}
                onChange={e => setConfidenceScore(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">复盘周期 (天)</label>
              <input type="number" min={1} value={reviewIntervalDays}
                onChange={e => setReviewIntervalDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">分类</label>
              <select value={categoryId ?? ''} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm">
                <option value="">未分类</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 背景 + 关联领域 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">背景 / 触发原因</label>
              <textarea value={context} onChange={e => setContext(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm" rows={3} placeholder="是什么促使你做这个决策？" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">关联领域</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {contexts.map(c => (
                  <button key={c.id} onClick={() => toggleDomain(c.domain)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      relatedDomains.includes(c.domain)
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
              {options.map((opt, i) => (
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
                  <button onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    className="mt-2 text-xs text-red-500 hover:text-red-600">删除选项</button>
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

          {/* 最终选择 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">最终选择</label>
            <select value={chosenOption} onChange={e => setChosenOption(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm">
              <option value="">-- 请选择 --</option>
              {options.map((opt, i) => (
                <option key={i} value={opt.name}>{opt.name}</option>
              ))}
            </select>
          </div>

          {/* 决策理由 */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">决策理由</label>
            <textarea value={rationale} onChange={e => setRationale(e.target.value)}
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
            {aiAdviceResult && (
              <div className="space-y-3">
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
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">建议</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{aiAdviceResult.advice}</p>
                </div>
                {aiAdviceResult.analysis && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">分析</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{aiAdviceResult.analysis}</p>
                  </div>
                )}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
