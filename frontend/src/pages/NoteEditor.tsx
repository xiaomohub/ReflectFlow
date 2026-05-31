import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import { ArrowLeft, Save, Trash2, Sparkles } from 'lucide-react';
import { notesApi } from '../api/client';
import type { NoteCategory } from '../api/client';

export default function NoteEditor() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isNew = location.pathname === '/notes/new';
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [tags, setTags] = useState<string>('');
  const [decisionId, setDecisionId] = useState<number | null>(() => {
    const d = searchParams.get('decision_id');
    return d ? Number(d) : null;
  });
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // 安全网：3 秒后无论如何关闭加载态
    const timer = setTimeout(() => setLoading(false), 3000);
    notesApi.listCategories().then(cats => {
      setCategories(cats);
      // /notes/new 不需要 loading，但编辑页需要关闭
      if (isNew) setLoading(false);
    }).catch(() => {
      setCategories([]);
      if (isNew) setLoading(false);
    });
    if (!isNew && id) {
      notesApi.get(Number(id)).then(note => {
        setTitle(note.title);
        setContent(note.content);
        setCategoryId(note.category_id);
        setTags((note.tags || []).join(', '));
        setLoading(false);
        clearTimeout(timer);
      }).catch(() => {
        setLoading(false);
        clearTimeout(timer);
      });
    } else {
      // /notes/new 无需加载笔记数据
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const data: Record<string, unknown> = {
      title,
      content,
      category_id: categoryId,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      decision_id: decisionId,
    };
    try {
      if (isNew) {
        const note = await notesApi.create(data);
        navigate(`/notes/${note.id}`, { replace: true });
      } else {
        await notesApi.update(Number(id), data);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '保存失败，请重试';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这篇笔记吗？')) return;
    try {
      await notesApi.delete(Number(id));
      navigate('/notes', { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '删除失败';
      setSaveError(msg);
    }
  };

  const handleExtractSkills = async () => {
    if (!id || isNew) return;
    setExtracting(true);
    try {
      await notesApi.extractSkills(Number(id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '提取失败';
      setSaveError(msg);
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* 顶栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/notes')}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            {isNew ? '新建笔记' : '编辑笔记'}
          </h2>
        </div>
        {saveError && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg">
            <span className="text-red-500">⚠</span>
            {saveError}
            <button onClick={() => setSaveError(null)} className="ml-1 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={handleExtractSkills}
              disabled={extracting}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${extracting ? 'animate-spin' : ''}`} />
              {extracting ? '提取中...' : '提取技能'}
            </button>
          )}
          {!isNew && (
            <button
              onClick={handleDelete}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="删除笔记"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 元信息 */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="笔记标题"
            className="w-full px-4 py-3 text-lg font-medium border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400"
          />
        </div>
        <div className="w-44">
          <select
            value={categoryId ?? ''}
            onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
          >
            <option value="">未分类</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="w-56">
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="标签（逗号分隔）"
            className="w-full px-3 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm placeholder-slate-400"
          />
        </div>
        {decisionId && (
          <div className="w-auto">
            <div className="px-3 py-3 text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800 whitespace-nowrap">
              <span className="font-medium">关联决策 #{decisionId}</span>
            </div>
          </div>
        )}
      </div>

      {/* Markdown 编辑器 */}
      <div data-color-mode="light">
        <MDEditor
          value={content}
          onChange={val => setContent(val || '')}
          height={600}
          preview="live"
        />
      </div>
    </div>
  );
}
