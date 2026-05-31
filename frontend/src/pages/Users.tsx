import { useEffect, useState } from 'react';
import { Shield, Plus, UserCog } from 'lucide-react';
import { usersApi } from '../api/client';
import type { AppUser } from '../api/client';

type NewUserForm = {
  username: string;
  password: string;
  display_name: string;
  role: 'admin' | 'normal';
};

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [me, setMe] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>({
    username: '',
    password: '123456',
    display_name: '',
    role: 'normal',
  });

  const load = async () => {
    setLoading(true);
    try {
      const meData = await usersApi.me();
      setMe(meData);
      if (meData.role === 'admin') {
        const list = await usersApi.list();
        setUsers(list);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.display_name.trim()) return;
    setSaving(true);
    try {
      await usersApi.create({
        username: newUser.username.trim(),
        password: newUser.password.trim(),
        display_name: newUser.display_name.trim(),
        role: newUser.role,
      });
      setNewUser({ username: '', password: '123456', display_name: '', role: 'normal' });
      setShowCreate(false);
      await load();
    } catch (e) {
      alert(`创建失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: number, role: 'admin' | 'normal') => {
    try {
      await usersApi.update(userId, { role });
      await load();
    } catch (e) {
      alert(`更新失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  const handleStatusChange = async (userId: number, isActive: boolean) => {
    try {
      await usersApi.update(userId, { is_active: isActive });
      await load();
    } catch (e) {
      alert(`更新失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>;
  }

  if (!me || me.role !== 'admin') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
        <Shield className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">无权限访问</h2>
        <p className="text-sm text-slate-500 mt-1">该页面仅管理员可访问。</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">权限管理</h2>
          <p className="text-slate-500 mt-1 text-sm">管理管理员和普通人员，并按人员隔离数据</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增人员
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-4 gap-3">
            <input
              value={newUser.username}
              onChange={(e) => setNewUser((v) => ({ ...v, username: e.target.value }))}
              placeholder="用户名（唯一）"
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
            />
            <input
              value={newUser.password}
              onChange={(e) => setNewUser((v) => ({ ...v, password: e.target.value }))}
              placeholder="初始密码"
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
            />
            <input
              value={newUser.display_name}
              onChange={(e) => setNewUser((v) => ({ ...v, display_name: e.target.value }))}
              placeholder="显示名称"
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((v) => ({ ...v, role: e.target.value as 'admin' | 'normal' }))}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
            >
              <option value="normal">普通人员</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {saving ? '创建中...' : '创建'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-700"
          >
            <div className="flex items-center gap-3">
              <UserCog className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{u.display_name}</p>
                <p className="text-xs text-slate-400">@{u.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'normal')}
                className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs"
              >
                <option value="normal">普通人员</option>
                <option value="admin">管理员</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={u.is_active}
                  onChange={(e) => handleStatusChange(u.id, e.target.checked)}
                />
                启用
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
