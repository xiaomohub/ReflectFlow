import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Rss, Inbox, GitBranch, Brain, RefreshCw, FileText, Shield,
} from 'lucide-react';
import { getCurrentUserId, setCurrentUserId, usersApi } from '../api/client';
import type { AppUser } from '../api/client';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/sources', icon: Rss, label: '信息源', adminOnly: true },
  { to: '/inbox', icon: Inbox, label: '收件箱', adminOnly: true },
  { to: '/notes', icon: FileText, label: '笔记' },
  { to: '/contexts', icon: Brain, label: '关注领域' },
  { to: '/decisions', icon: GitBranch, label: '决策管理' },
  { to: '/review', icon: RefreshCw, label: '待复盘' },
  { to: '/users', icon: Shield, label: '权限管理', adminOnly: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [me, setMe] = useState<AppUser | null>(null);
  const [selectedId, setSelectedId] = useState<number>(getCurrentUserId());

  const loadUsers = async () => {
    try {
      const current = await usersApi.me();
      const activeUsers = await usersApi.active();
      setMe(current);

      const inList = activeUsers.some((u) => u.id === selectedId);
      if (!inList) {
        setSelectedId(current.id);
        setCurrentUserId(current.id);
      }
      setUsers(activeUsers);
    } catch {
      setUsers([]);
      setMe(null);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const visibleNav = navItems.filter((item) => !item.adminOnly || me?.role === 'admin');

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
        <div className="px-4 pt-4">
          <label className="block text-xs text-slate-400 mb-1.5">当前人员</label>
          <select
            value={selectedId}
            onChange={async (e) => {
              const nextId = Number(e.target.value);
              setSelectedId(nextId);
              setCurrentUserId(nextId);
              setMe(null);
              window.location.reload();
            }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm disabled:opacity-60"
            disabled={users.length === 0}
          >
            {users.length === 0 && <option value={selectedId}>加载中...</option>}
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}（{u.role === 'admin' ? '管理员' : '普通人员'}）
              </option>
            ))}
          </select>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {visibleNav.map((item) => (
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
