import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, RefreshCw, Rss, Globe, Code, MessageCircle, Settings, Clock, Filter, Eye, ChevronDown, ChevronUp, Share2, Upload, X, CheckSquare, Square } from 'lucide-react';
import { sourcesApi, articlesApi, settingsApi } from '../api/client';
import type { Source, AppSettings, Article } from '../api/client';

const typeIcons: Record<string, React.ElementType> = { rss: Rss, webpage: Globe, api: Code, newsletter: Rss, xueqiu: MessageCircle, rsshub: Share2 };
const typeLabels: Record<string, string> = { rss: 'RSS', webpage: '网页', api: 'API', xueqiu: '雪球', rsshub: 'RSSHub' };

/** RSSHub 平台预设 */
type RsshubPreset = {
  id: string;
  label: string;
  urlTemplate: (id?: string) => string;
  placeholder: string;
  icon: string;
};

const RSSHUB_PRESETS: RsshubPreset[] = [
  { id: 'bilibili_user',   label: 'B站UP主',     urlTemplate: (id = '') => `https://rsshub.app/bilibili/user/video/${id}`,       placeholder: 'UP主UID，如 123456', icon: '📺' },
  { id: 'zhihu_people',    label: '知乎用户',     urlTemplate: (id = '') => `https://rsshub.app/zhihu/people/activities/${id}`,  placeholder: '用户主页路径，如 zhong-xian-wei-26', icon: '📝' },
  { id: 'zhihu_zhuanlan',  label: '知乎专栏',     urlTemplate: (id = '') => `https://rsshub.app/zhihu/zhuanlan/${id}`,           placeholder: '专栏ID，如 c_123456789', icon: '📰' },
  { id: 'zhihu_hotlist',   label: '知乎热榜',     urlTemplate: () => 'https://rsshub.app/zhihu/hotlist',                            placeholder: '', icon: '🔥' },
  { id: 'xueqiu_user',     label: '雪球用户',     urlTemplate: (id = '') => `https://rsshub.app/xueqiu/user/${id}`,              placeholder: '用户ID，如 1234567890', icon: '💬' },
  { id: 'weibo_user',      label: '微博用户',     urlTemplate: (id = '') => `https://rsshub.app/weibo/user/${id}`,               placeholder: '用户UID，如 1234567890', icon: '📱' },
  { id: 'douban_movie',    label: '豆瓣电影',     urlTemplate: () => 'https://rsshub.app/douban/movie/playing',                     placeholder: '', icon: '🎬' },
  { id: 'jike_user',       label: '即刻用户',     urlTemplate: (id = '') => `https://rsshub.app/jike/user/${id}`,                placeholder: '用户ID', icon: '⚡' },
  { id: 'custom',          label: '自定义路由',   urlTemplate: (id = '') => id,                                                    placeholder: '完整 RSSHub URL', icon: '🔗' },
];

/** JSON 导入模板示例 */
const sampleImportJson = JSON.stringify([
  { name: '36氪', source_type: 'rss', url: 'https://36kr.com/feed', description: '科技创投媒体', tags: ['科技', '创投'] },
  { name: 'InfoQ', source_type: 'rss', url: 'https://www.infoq.cn/feed', description: '技术社区', tags: ['技术', '架构'] },
], null, 2);

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', source_type: 'rss', url: '', description: '', tags: '', cookies: '' });
  const [rsshubPreset, setRsshubPreset] = useState<string>('');
  const [rsshubId, setRsshubId] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sourceArticles, setSourceArticles] = useState<Record<number, Article[]>>({});
  const [loadingArticles, setLoadingArticles] = useState<Record<number, boolean>>({});
  // Batch & import state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; errors: { index: number; name: string; error: string }[] } | null>(null);
  const navigate = useNavigate();

  useEffect(() => { loadSources(); loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
    } catch { /* ignore */ }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await settingsApi.update(settings);
      alert('设置已保存');
    } catch (e) {
      alert('保存失败: ' + e);
    }
    setSavingSettings(false);
  };

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
    setRsshubPreset('');
    setRsshubId('');
    loadSources();
  };

  const handleDelete = async (id: number) => {
    if (expandedId === id) setExpandedId(null);
    await sourcesApi.delete(id);
    loadSources();
  };

  const handleFetch = async (id?: number) => {
    await articlesApi.fetch(id);
    alert('拉取完成！');
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个信息源吗？\n关联的文章不会被删除。`)) return;
    await sourcesApi.batchDelete([...selectedIds]);
    setSelectedIds(new Set());
    setBatchMode(false);
    loadSources();
  };

  const handleImport = async () => {
    let items: unknown[];
    try {
      items = JSON.parse(importJson);
      if (!Array.isArray(items)) throw new Error('必须是 JSON 数组');
    } catch (e) {
      alert('JSON 格式错误: ' + (e instanceof Error ? e.message : e));
      return;
    }
    setImporting(true);
    try {
      const result = await sourcesApi.batchImport(items);
      setImportResult(result);
      if (result.errors.length === 0) {
        setTimeout(() => { setShowImport(false); setImportResult(null); }, 1500);
      }
      loadSources();
    } catch (e) {
      alert('导入失败: ' + e);
    }
    setImporting(false);
  };

  const toggleExpand = async (sourceId: number) => {
    if (expandedId === sourceId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sourceId);
    if (!sourceArticles[sourceId]) {
      setLoadingArticles(prev => ({ ...prev, [sourceId]: true }));
      try {
        const articles = await sourcesApi.articles(sourceId, 10);
        setSourceArticles(prev => ({ ...prev, [sourceId]: articles }));
      } catch { /* ignore */ }
      setLoadingArticles(prev => ({ ...prev, [sourceId]: false }));
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      read: 'bg-blue-100 text-blue-700',
      decide: 'bg-purple-100 text-purple-700',
      archive: 'bg-slate-100 text-slate-600',
      ignore: 'bg-red-100 text-red-600',
    };
    return colors[action] || colors.read;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">信息源管理</h2>
          <p className="text-slate-500 mt-1">配置 RSS、网页、API 等信息来源</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setShowSettings(!showSettings); loadSettings(); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <Settings className="w-4 h-4" />定时设置
          </button>
          <button onClick={() => handleFetch()} className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <RefreshCw className="w-4 h-4" />全部拉取
          </button>
          <button onClick={() => { setShowImport(true); setImportJson(sampleImportJson); setImportResult(null); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
            <Upload className="w-4 h-4" />批量导入
          </button>
          <button
            onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
              batchMode
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <Trash2 className="w-4 h-4" />批量删除
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            <Plus className="w-4 h-4" />添加信息源
          </button>
        </div>
      </div>

      {/* 批量操作工具栏 */}
      {batchMode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
          <button
            onClick={() => {
              if (selectedIds.size === sources.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(sources.map(s => s.id)));
              }
            }}
            className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-300 hover:text-red-800 transition-colors"
          >
            {selectedIds.size === sources.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selectedIds.size === sources.length ? '取消全选' : '全选'}
          </button>
          <span className="text-sm text-red-600 dark:text-red-400 font-medium">
            {selectedIds.size > 0
              ? `已选 ${selectedIds.size} / ${sources.length} 个信息源`
              : '请勾选要删除的信息源'}
          </span>
          <div className="flex-1" />
          {selectedIds.size > 0 ? (
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm"
            >
              <Trash2 className="w-4 h-4" />删除选中 ({selectedIds.size})
            </button>
          ) : (
            <span className="text-xs text-red-400">点击左侧复选框勾选</span>
          )}
          <button
            onClick={() => { setBatchMode(false); setSelectedIds(new Set()); }}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            退出
          </button>
        </div>
      )}

      {/* JSON 导入弹窗 */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImport(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">批量导入信息源</h3>
                <p className="text-sm text-slate-500 mt-0.5">粘贴 JSON 数组格式的信息源数据</p>
              </div>
              <button onClick={() => { setShowImport(false); setImportResult(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* 格式说明 */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">JSON 格式要求：</p>
                <pre className="text-xs mt-2 bg-blue-100/50 dark:bg-blue-900/30 p-3 rounded overflow-x-auto">
{`[
  {
    "name": "信息源名称",
    "source_type": "rss",        // rss | rsshub | webpage | api | xueqiu
    "url": "https://example.com/feed",
    "description": "描述文字",
    "tags": ["标签1", "标签2"],
    "enabled": true,
    "skip_filter": false,
    "config": {}
  }
]`}</pre>
              </div>

              <textarea
                value={importJson}
                onChange={e => { setImportJson(e.target.value); setImportResult(null); }}
                className="w-full h-64 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-sm font-mono focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                placeholder='粘贴 JSON 数组...'
              />

              {/* 导入结果 */}
              {importResult && (
                <div className={`rounded-xl p-4 text-sm ${
                  importResult.errors.length === 0
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex items-center gap-2 font-medium mb-1">
                    {importResult.errors.length === 0 ? '✅' : '⚠️'} {importResult.message}
                  </div>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i} className="text-xs">
                          #{err.index} 「{err.name}」: {err.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <p className="text-xs text-slate-400">支持拖拽全选替换模板数据</p>
              <div className="flex gap-3">
                <button onClick={() => { setShowImport(false); setImportResult(null); }} className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  取消
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !importJson.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {importing ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> 导入中...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> 开始导入</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && settings && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-slate-500" />
            <h3 className="font-semibold text-slate-800 dark:text-white">自动拉取设置</h3>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_fetch_enabled}
                onChange={e => setSettings({ ...settings, auto_fetch_enabled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">启用定时拉取</span>
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">每</label>
              <input
                type="number"
                min={1}
                max={168}
                value={settings.auto_fetch_interval_hours}
                onChange={e => setSettings({ ...settings, auto_fetch_interval_hours: Math.max(1, parseInt(e.target.value) || 12) })}
                disabled={!settings.auto_fetch_enabled}
                className="w-20 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm disabled:opacity-50"
              />
              <label className="text-sm text-slate-600 dark:text-slate-400">小时拉取一次</label>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {savingSettings ? '保存中...' : '保存设置'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">启用后，系统将每 10 分钟检查一次，对超过设定时间未拉取的信息源自动拉取新文章。</p>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">AI 过滤增强</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  重要人物 <span className="text-xs text-blue-400">（逗号分隔，命中后相关度 +0.2）</span>
                </label>
                <textarea
                  value={settings.important_figures}
                  onChange={e => setSettings({ ...settings, important_figures: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
                  rows={3}
                  placeholder="例如: 马斯克, Trump, 巴菲特, 黄仁勋"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  敏感词过滤 <span className="text-xs text-red-400">（命中直接删除文章）</span>
                </label>
                <textarea
                  value={settings.sensitive_words}
                  onChange={e => setSettings({ ...settings, sensitive_words: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
                  rows={3}
                  placeholder="例如: 敏感词1, 敏感词2"
                />
              </div>
            </div>
          </div>
        </div>
      )}

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
              <select value={form.source_type} onChange={e => {
                  setForm({ ...form, source_type: e.target.value, url: '' });
                  setRsshubPreset('');
                  setRsshubId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm">
                <option value="rss">RSS</option>
                <option value="rsshub">RSSHub（B站/知乎/微博等）</option>
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

            {/* RSSHub 平台预设 */}
            {form.source_type === 'rsshub' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">选择平台</label>
                <div className="grid grid-cols-3 gap-2">
                  {RSSHUB_PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setRsshubPreset(p.id);
                        setRsshubId('');
                        if (!p.placeholder) {
                          // 无参数预设（如知乎热榜），直接生成 URL
                          setForm(f => ({ ...f, name: f.name || p.label, url: p.urlTemplate('') }));
                        }
                      }}
                      className={`flex flex-col items-center gap-1 px-3 py-3 rounded-lg border-2 text-sm transition-all ${
                        rsshubPreset === p.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-600 hover:border-blue-300 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>

                {/* 参数输入（需要用户 ID 的预设） */}
                {rsshubPreset && RSSHUB_PRESETS.find(p => p.id === rsshubPreset)?.placeholder && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={rsshubId}
                      onChange={e => setRsshubId(e.target.value)}
                      placeholder={RSSHUB_PRESETS.find(p => p.id === rsshubPreset)?.placeholder}
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && rsshubId.trim()) {
                          const preset = RSSHUB_PRESETS.find(p => p.id === rsshubPreset);
                          if (preset) {
                            setForm(f => ({ ...f, name: f.name || preset.label, url: preset.urlTemplate(rsshubId.trim()) }));
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const preset = RSSHUB_PRESETS.find(p => p.id === rsshubPreset);
                        if (preset) {
                          setForm(f => ({ ...f, name: f.name || preset.label, url: preset.urlTemplate(rsshubId.trim()) }));
                        }
                      }}
                      disabled={!rsshubId.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      生成 URL
                    </button>
                  </div>
                )}

                {/* 预览 URL */}
                {form.url && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 break-all">
                    RSSHub URL: {form.url}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  支持所有 RSSHub 路由。也可自建 RSSHub 实例，将 rsshub.app 替换为自建地址。
                </p>
              </div>
            )}
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
          const isExpanded = expandedId === s.id;
          const isSelected = selectedIds.has(s.id);
          return (
            <div key={s.id} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border transition-all ${
              batchMode && isSelected
                ? 'border-red-400 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-800'
                : 'border-slate-200 dark:border-slate-700'
            }`}>
              {/* Source Card Header */}
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* 批量选择复选框 */}
                  {batchMode && (
                    <button
                      onClick={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      }}
                      className="shrink-0"
                    >
                      {isSelected
                        ? <CheckSquare className="w-5 h-5 text-red-500" />
                        : <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                      }
                    </button>
                  )}
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
                    {s.skip_filter && <span className="inline-block ml-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">不过滤</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpand(s.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      isExpanded ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-blue-500'
                    }`}
                    title={isExpanded ? '收起' : '展开内容'}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={async () => {
                      await sourcesApi.update(s.id, { skip_filter: !s.skip_filter });
                      loadSources();
                    }}
                    className={`p-2 text-xs rounded-lg transition-colors ${
                      s.skip_filter
                        ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-400 hover:text-amber-500'
                    }`}
                    title={s.skip_filter ? '点击恢复过滤' : '点击跳过过滤'}
                  >
                    <Filter className="w-4 h-4" />
                  </button>
                  <button onClick={() => navigate(`/inbox?source_id=${s.id}`)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors" title="查看全部内容">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleFetch(s.id)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors" title="拉取">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="删除">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Article List */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4">
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">最近文章</h4>
                  {loadingArticles[s.id] ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                    </div>
                  ) : sourceArticles[s.id]?.length > 0 ? (
                    <div className="space-y-2">
                      {sourceArticles[s.id]!.map((article) => (
                        <div key={article.id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          onClick={() => navigate(`/inbox?source_id=${s.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{article.title}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-400">
                                {new Date(article.created_at).toLocaleDateString('zh-CN')}
                              </span>
                              {article.relevance_score > 0 && (
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                  article.relevance_score >= 0.7 ? 'bg-green-100 text-green-700' :
                                  article.relevance_score >= 0.4 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {(article.relevance_score * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                          {article.suggested_action && (
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${getActionBadge(article.suggested_action)}`}>
                              {article.suggested_action === 'decide' ? '需决策' : article.suggested_action === 'read' ? '值得读' : article.suggested_action}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 py-4 text-center">暂无文章，点击拉取获取最新内容</p>
                  )}
                </div>
              )}
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
