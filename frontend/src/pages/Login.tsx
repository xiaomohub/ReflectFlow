import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { setAuthToken, usersApi } from '../api/client';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await usersApi.login(username.trim(), password);
      setAuthToken(result.token);
      navigate('/', { replace: true });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">登录复盘系统</h1>
        <p className="text-sm text-slate-500 mt-1">请输入账号和密码</p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-400">账号</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入账号"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
            disabled={submitting}
          />
          <label className="block text-xs text-slate-400">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm"
            disabled={submitting}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2.5">
            <p>默认账号：</p>
            <p>管理员：admin / admin123</p>
            <p>普通人员：user / user123</p>
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={submitting || !username.trim() || !password.trim()}
          className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          {submitting ? '登录中...' : '登录'}
        </button>
      </div>
    </div>
  );
}
