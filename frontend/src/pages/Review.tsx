import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { decisionsApi } from '../api/client';
import type { Decision } from '../api/client';

export default function Review() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    decisionsApi.dueReviews().then((d) => {
      setDecisions(d);
      setLoading(false);
    });
  }, []);

  const getOverdueDays = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">待复盘决策</h2>
        <p className="text-slate-500 mt-1">定期回顾决策结果，持续改进决策质量</p>
      </div>

      {decisions.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">所有决策都已复盘</p>
          <p className="text-sm mt-1">继续保持！定期复盘是提升决策质量的关键</p>
        </div>
      ) : (
        <div className="space-y-4">
          {decisions.map((d) => {
            const overdue = getOverdueDays(d.next_review_date);
            return (
              <div key={d.id} onClick={() => navigate(`/decisions/${d.id}`)}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${
                      overdue > 7 ? 'bg-red-50 text-red-500' :
                      overdue > 0 ? 'bg-amber-50 text-amber-500' :
                      'bg-green-50 text-green-500'
                    }`}>
                      {overdue > 7 ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-800 dark:text-white">{d.title}</h3>
                      <p className="text-sm text-slate-400 mt-1">
                        决策于 {d.decided_at ? new Date(d.decided_at).toLocaleDateString('zh-CN') : '未知'}
                        {' · '}信心指数 {d.confidence_score}/10
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-medium ${
                      overdue > 7 ? 'text-red-500' :
                      overdue > 0 ? 'text-amber-500' :
                      'text-green-500'
                    }`}>
                      {overdue > 0 ? `逾期 ${overdue} 天` : '今日到期'}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      {d.chosen_option ? `选择: ${d.chosen_option}` : '未选择'}
                    </p>
                  </div>
                </div>
                {d.last_reviewed_at && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-400">上次复盘: {new Date(d.last_reviewed_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
