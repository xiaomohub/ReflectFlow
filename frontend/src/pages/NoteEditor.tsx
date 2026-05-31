import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
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
  const [decisionId] = useState<number | null>(() => {
    const d = searchParams.get('decision_id');
    return d ? Number(d) : null;
  });
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isBodyEditing, setIsBodyEditing] = useState(isNew);
  const editorWrapRef = useRef<HTMLDivElement | null>(null);
  const markdownInputRef = useRef<HTMLTextAreaElement | null>(null);

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

  useEffect(() => {
    if (!isBodyEditing) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!editorWrapRef.current) return;
      if (!editorWrapRef.current.contains(event.target as Node)) {
        setIsBodyEditing(false);
      }
    };
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        setIsBodyEditing(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [isBodyEditing]);

  const outline = useMemo(() => {
    return content
      .split('\n')
      .map((line) => line.match(/^(#{1,3})\s+(.+)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => {
        const level = match[1].length;
        const title = match[2].trim();
        const slug = title
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
        return { level, title, slug };
      });
  }, [content]);

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
        setIsBodyEditing(false);
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

  const insertMarkdownSnippet = (snippet: string) => {
    const textarea = markdownInputRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}\n${snippet}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    const next = `${before}${snippet}${selected}${after}`;
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + snippet.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
  }

  return (
    <div className="note-editor-eye-care min-h-[calc(100vh-5rem)] rounded-2xl bg-emerald-50 p-3 md:p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* 顶部工具栏 */}
        <div className="note-toolbar sticky top-3 z-10 rounded-xl border border-emerald-200 bg-emerald-50/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/notes')}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{isNew ? '新建文档' : '编辑文档'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">文档编辑工作区</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {isBodyEditing ? '编辑中（点击外部自动收起）' : '展示中（点击正文进入编辑）'}
              </span>
              {!isNew && (
                <button
                  onClick={handleExtractSkills}
                  disabled={extracting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
                >
                  <Sparkles className={`h-4 w-4 ${extracting ? 'animate-spin' : ''}`} />
                  {extracting ? '提取中...' : '提取技能'}
                </button>
              )}
              {!isNew && (
                <button
                  onClick={handleDelete}
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-300 dark:hover:bg-red-900/20"
                  title="删除笔记"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
          {saveError && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
              <span className="text-red-500">⚠</span>
              {saveError}
              <button onClick={() => setSaveError(null)} className="ml-1 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
        </div>

        {/* 文档纸张 */}
        <div className="note-paper mx-auto max-w-6xl rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.25)] md:p-7 dark:border-slate-700 dark:bg-slate-900">
          <div className="space-y-4 border-b border-slate-100 pb-5 dark:border-slate-700">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="请输入文档标题"
              className="w-full bg-transparent text-3xl font-semibold text-slate-800 placeholder:text-slate-300 outline-none dark:text-white dark:placeholder:text-slate-500"
            />
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <select
                value={categoryId ?? ''}
                onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
              >
                <option value="">未分类</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="标签（例如：总结,产品,AI）"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 md:max-w-lg dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40"
              />
              {decisionId && (
                <div className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                  <span className="font-medium whitespace-nowrap">关联决策 #{decisionId}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="note-outline rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">大纲</p>
              {outline.length > 0 ? (
                <div className="space-y-1">
                  {outline.map((item, index) => (
                    <button
                      type="button"
                      key={`${item.slug}-${index}`}
                      onClick={() => {
                        const element = document.getElementById(item.slug);
                        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`block w-full truncate rounded-md px-2 py-1 text-left text-xs text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${item.level === 2 ? 'pl-4' : item.level === 3 ? 'pl-6' : ''}`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">使用 # / ## / ### 自动生成目录。</p>
              )}
            </aside>

            {isBodyEditing ? (
              <div ref={editorWrapRef} className="note-editor-shell yuque-mdx-shell rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="note-markdown-toolbar mb-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => insertMarkdownSnippet('### ')} className="note-md-btn">H3</button>
                  <button type="button" onClick={() => insertMarkdownSnippet('- ')} className="note-md-btn">列表</button>
                  <button type="button" onClick={() => insertMarkdownSnippet('> ')} className="note-md-btn">引用</button>
                  <button
                    type="button"
                    onClick={() => insertMarkdownSnippet('\n```js\nconsole.log(\'hello\')\n```\n')}
                    className="note-md-btn"
                  >
                    代码块
                  </button>
                </div>
                <textarea
                  ref={markdownInputRef}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  onBlur={(event) => {
                    const next = event.relatedTarget as Node | null;
                    if (next && editorWrapRef.current?.contains(next)) return;
                    setTimeout(() => {
                      const active = document.activeElement;
                      if (!active || !editorWrapRef.current?.contains(active)) {
                        setIsBodyEditing(false);
                      }
                    }, 0);
                  }}
                  className="note-markdown-input w-full"
                  placeholder={'直接写 Markdown：\n\n### 标题\n\n```js\nconsole.log("hello")\n```\n'}
                />
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">支持 Markdown 原生语法：`###`、```、列表、引用都会自动转成展示样式。</p>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsBodyEditing(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setIsBodyEditing(true);
                  }
                }}
                className="note-display yuque-markdown-display rounded-xl border border-emerald-200 bg-emerald-50 px-7 py-7 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-100/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800"
              >
                {content.trim() ? (
                  <article className="yuque-markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight, rehypeSlug]}>
                      {content}
                    </ReactMarkdown>
                  </article>
                ) : (
                  <p className="text-base text-slate-400 dark:text-slate-500">点击这里开始编写 Markdown，完成后会自动展示成文档样式。</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
