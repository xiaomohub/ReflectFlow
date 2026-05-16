import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GitBranch, Rss, Inbox, RefreshCw, AlertCircle, Star,
} from 'lucide-react';
import { decisionsApi, articlesApi } from '../api/client';
import type { Decision, Article } from '../api/client';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, abandoned: 0, due_reviews: 0 });
  const [dueReviews, setDueReviews] = useState<Decision[]>([]);
  const [topArticles, setTopArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      decisionsApi.stats(),
      decisionsApi.dueReviews(),
      articlesApi.list({ sort_by: 'relevance_score', page_size: 5 }),
    ]).then(([s, reviews, page]) => {
      setStats(s);
      setDueReviews(reviews);
      setTopArticles(page.items);
    }).catch(() => {
      setTopArticles([]);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">仪表盘</h2>
        <p className="text-slate-500 mt-1">个人复盘系统总览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard icon={Rss} label="信息源" value="已配置" sub="管理信息源" to="/sources" color="blue" />
        <StatCard icon={Inbox} label="待处理文章" value={topArticles.length.toString()} sub="AI 排序中" to="/inbox" color="purple" />
        <StatCard icon={GitBranch} label="进行中决策" value={stats.active.toString()} sub={`共 ${stats.total} 个决策`} to="/decisions" color="green" />
        <StatCard icon={RefreshCw} label="待复盘" value={stats.due_reviews.toString()} sub="到期需复盘" to="/review" color="amber" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 待复盘列表 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              待复盘决策
            </h3>
            <Link to="/review" className="text-sm text-blue-500 hover:underline">查看全部</Link>
          </div>
          {dueReviews.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">没有待复盘的决策</p>
          ) : (
            <div className="space-y-3">
              {dueReviews.slice(0, 5).map((d) => (
                <Link key={d.id} to={`/decisions/${d.id}`}
                  className="block p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{d.title}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    决策于 {d.decided_at ? new Date(d.decided_at).toLocaleDateString('zh-CN') : '未知'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 高相关度文章 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              高价值信息
            </h3>
            <Link to="/inbox" className="text-sm text-blue-500 hover:underline">查看全部</Link>
          </div>
          {topArticles.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">暂无文章，先配置信息源</p>
          ) : (
            <div className="space-y-3">
              {topArticles.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{a.title}</p>
                    <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                      a.relevance_score >= 0.7
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {(a.relevance_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {a.relevance_reason && (
                    <p className="text-xs text-slate-400 mt-1">{a.relevance_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub: _sub, to, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; to: string; color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <Link to={to} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </Link>
  );
}
