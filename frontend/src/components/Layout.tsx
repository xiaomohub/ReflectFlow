import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Rss, Inbox, GitBranch, Brain, RefreshCw,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/sources', icon: Rss, label: '信息源' },
  { to: '/inbox', icon: Inbox, label: '收件箱' },
  { to: '/contexts', icon: Brain, label: '关注领域' },
  { to: '/decisions', icon: GitBranch, label: '决策管理' },
  { to: '/review', icon: RefreshCw, label: '待复盘' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            复盘系统
          </h1>
          <p className="text-xs text-slate-500 mt-1">信息 → 决策 → 复盘</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
