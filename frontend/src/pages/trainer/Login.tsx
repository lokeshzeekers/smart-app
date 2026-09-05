import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function TrainerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/trainer/login', { email, password });
      login(data.token, data.user);
      navigate(data.user.role === 'admin' ? '/admin/dashboard' : '/trainer/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-7 py-10 max-w-md mx-auto">
      <div className="text-center mb-10">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-700 flex items-center justify-center mb-5 shadow-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 className="font-display font-semibold text-2xl text-ink-900">Trainer Login</h1>
        <p className="text-ink-500 text-sm mt-2">SMArT institution review console</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-ink-500 mb-1.5 block">Institutional email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="trainer@institution.edu"
            className="w-full border border-surface-border rounded-xl px-4 py-3.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="text-sm text-ink-500 mb-1.5 block">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full border border-surface-border rounded-xl px-4 py-3.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {error && <p className="text-status-fail text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-700 text-white rounded-xl py-3.5 font-medium text-[15px] hover:bg-brand-600 transition disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <Link to="/" className="text-center text-sm text-brand-700 mt-6 block">
        ← Back to trainee login
      </Link>
    </div>
  );
}
