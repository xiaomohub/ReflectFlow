import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, Plus, Trash2, FolderOpen, FolderPlus, Edit3, Check, X, Download, Sparkles, Search,
} from 'lucide-react';
import { notesApi } from '../api/client';
import type { Note, NoteCategory } from '../api/client';

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[] | null>(null);
  const [extractingId, setExtractingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadCategories();
    const catId = searchParams.get('category_id');
    if (catId) setSelectedCategory(Number(catId));
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      loadNotes();
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const cats = await notesApi.listCategories();
      setCategories(cats);
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  };

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await notesApi.list({ category_id: selectedCategory ?? undefined });
      setNotes(result);
    } catch (e) {
      console.error('Failed to load notes:', e);
      setError(e instanceof Error ? e.message : '加载笔记失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    const results = await notesApi.search(searchQuery);
    setSearchResults(results);
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('确定要删除这篇笔记吗？')) return;
    await notesApi.delete(id);
    searchResults ? handleSearch() : loadNotes();
  };

  const handleExtractSkills = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setExtractingId(id);
    await notesApi.extractSkills(id);
    setExtractingId(null);
    searchResults ? handleSearch() : loadNotes();
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    await notesApi.createCategory({ name: newCategoryName.trim() });
    setNewCategoryName('');
    setShowNewCategory(false);
    loadCategories();
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个分类吗？')) return;
    await notesApi.deleteCategory(id);
    if (selectedCategory === id) setSelectedCategory(null);
    loadCategories();
    loadNotes();
  };

  const handleRenameCategory = async (id: number) => {
    if (!editCategoryName.trim()) return;
    await notesApi.updateCategory(id, { name: editCategoryName.trim() });
    setEditingCategory(null);
    loadCategories();
  };

  const displayedNotes = searchResults !== null ? searchResults : notes;

  const totalWords = displayedNotes.reduce((sum, n) => sum + (n.word_count || 0), 0);

  const categoryCounts = notes.reduce<Record<number, number>>((acc, n) => {
    if (n.category_id) acc[n.category_id] = (acc[n.category_id] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">笔记</h2>
          <p className="text-slate-500 mt-1">记录思考、提炼技能</p>
        </div>
        <button
          onClick={() => navigate('/notes/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />新建笔记
        </button>
      </div>

      {/* 统计条 */}
      <div className="flex items-center gap-6 text-sm bg-white dark:bg-slate-800 rounded-xl px-5 py-3 shadow-sm border border-slate-200 dark:border-slate-700">
        <span className="text-slate-500">共 <strong className="text-slate-800 dark:text-white text-base">{notes.length}</strong> 篇笔记</span>
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <span className="text-slate-500">
          总计 <strong className="text-slate-800 dark:text-white">{totalWords.toLocaleString()}</strong> 字
        </span>
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <span className="text-slate-500">
          <strong className="text-slate-800 dark:text-white">{categories.length}</strong> 个分类
        </span>
        {displayedNotes.filter(n => n.ai_skills?.length > 0).length > 0 && (
          <>
            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <strong>{displayedNotes.filter(n => n.ai_skills?.length > 0).length}</strong> 篇已提取技能
            </span>
          </>
        )}
      </div>

      {/* 搜索 */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="搜索笔记..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-sm hover:bg-slate-200 transition-colors"
        >
          搜索
        </button>
        {searchResults !== null && (
          <button
            onClick={() => { setSearchQuery(''); setSearchResults(null); }}
            className="px-4 py-2 text-sm text-blue-500 hover:text-blue-600"
          >
            清除搜索
          </button>
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
                <button onClick={handleCreateCategory} className="p-1 text-green-500"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setShowNewCategory(false)} className="p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                selectedCategory === null
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                全部笔记
              </span>
              <span className="text-xs text-slate-400">{notes.length}</span>
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
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{categoryCounts[cat.id] || 0}</span>
                  </button>
                )}
                {editingCategory !== cat.id && (
                  <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
                    <button onClick={() => { setEditingCategory(cat.id); setEditCategoryName(cat.name); }} className="p-1 text-slate-400 hover:text-blue-500">
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => handleDeleteCategory(e, cat.id)} className="p-1 text-slate-400 hover:text-red-500">
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

        {/* 笔记列表 */}
        <div className="flex-1 min-w-0">
          {searchResults !== null && (
            <p className="text-sm text-slate-500 mb-4">搜索结果: {searchResults.length} 篇</p>
          )}

          {error ? (
            <div className="text-center py-16">
              <p className="text-red-500 mb-2">{error}</p>
              <button onClick={loadNotes} className="text-sm text-blue-500 hover:text-blue-600">重试</button>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>
          ) : (
            <div className="grid gap-4">
              {displayedNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => navigate(`/notes/${note.id}`)}
                  className="group bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* 标题行 */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-medium text-slate-800 dark:text-white truncate">{note.title}</h3>
                        {note.category_id && categories.find(c => c.id === note.category_id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 shrink-0">
                            {categories.find(c => c.id === note.category_id)!.name}
                          </span>
                        )}
                      </div>

                      {/* 内容预览 */}
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {note.snippet
                          ? note.snippet
                          : (note.content?.replace(/[#*`\[\]]/g, '').slice(0, 200) || '空内容')}
                      </p>

                      {/* 底部信息栏 */}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-slate-500">{note.word_count}</span>
                          字
                        </span>
                        <span>{new Date(note.updated_at).toLocaleDateString('zh-CN')}</span>
                        {note.tags?.length > 0 && note.tags.slice(0, 3).map(tag => (
                          <span key={String(tag)} className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs text-slate-500">
                            {String(tag)}
                          </span>
                        ))}
                        {note.tags?.length > 3 && (
                          <span className="text-slate-300">+{note.tags.length - 3}</span>
                        )}
                        {note.ai_skills?.length > 0 && (
                          <span className="flex items-center gap-1 text-amber-500">
                            <Sparkles className="w-3 h-3" />
                            {note.ai_skills.length} 条技能
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={notesApi.download(note.id)}
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 text-slate-300 hover:text-blue-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="下载 Markdown"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={(e) => handleExtractSkills(e, note.id)}
                        disabled={extractingId === note.id}
                        className="p-1.5 text-slate-300 hover:text-amber-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                        title="提取技能"
                      >
                        <Sparkles className={`w-4 h-4 ${extractingId === note.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, note.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {displayedNotes.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{searchResults !== null ? '没有找到匹配的笔记' : '还没有笔记'}</p>
                  {searchResults === null && (
                    <p className="text-sm mt-1">点击"新建笔记"开始记录</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
