import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function TraineeLogin() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { email });
      setStage('otp');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/otp/verify', { email, code });
      login(data.token, data.user);
      navigate('/trainee/home');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-7 py-10 max-w-md mx-auto">
      <div className="text-center mb-10">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-700 flex items-center justify-center mb-5 shadow-card">
          {/* Stethoscope */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M6 3v6a4 4 0 008 0V3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 13v2a5 5 0 005 5 5 5 0 005-5v-1.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="20" cy="12.5" r="1.8" stroke="#fff" strokeWidth="1.6"/>
            <circle cx="6" cy="3" r="1.3" stroke="#fff" strokeWidth="1.4"/>
            <circle cx="14" cy="3" r="1.3" stroke="#fff" strokeWidth="1.4"/>
          </svg>
        </div>
        <h1 className="font-display font-semibold text-2xl text-ink-900 leading-tight">SMArT</h1>
        <p className="text-ink-500 text-sm mt-2 leading-relaxed">
          Simulation-based Management<br />of Airway Training
        </p>
      </div>

      {stage === 'email' && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div>
            <label className="text-sm text-ink-500 mb-1.5 block">Enter your email registered with your University</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domain.com"
              className="w-full border border-surface-border rounded-xl px-4 py-3.5 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {error && <p className="text-status-fail text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-700 text-white rounded-xl py-3.5 font-medium text-[15px] hover:bg-brand-600 transition disabled:opacity-60"
          >
            {loading ? 'Sending code…' : 'Continue'}
          </button>
        </form>
      )}

      {stage === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="text-sm text-ink-500 mb-1.5 block">Enter the 6-digit code sent to {email}</label>
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="w-full border border-surface-border rounded-xl px-4 py-3.5 text-[15px] tracking-[0.4em] text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {error && <p className="text-status-fail text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-700 text-white rounded-xl py-3.5 font-medium text-[15px] hover:bg-brand-600 transition disabled:opacity-60"
          >
            {loading ? 'Verifying…' : 'Verify & Continue'}
          </button>
          <button type="button" onClick={() => setStage('email')} className="w-full text-brand-700 text-sm py-1">
            Use a different email
          </button>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-surface-border text-center">
        <p className="text-xs text-ink-300 mb-3">Trainers use the button below</p>
        <Link
          to="/trainer/login"
          className="inline-block w-full bg-surface-muted rounded-xl py-3.5 font-medium text-[15px] text-ink-700 hover:bg-surface-border transition"
        >
          Trainer Login
        </Link>
      </div>

      <p className="text-center text-xs text-ink-300 mt-8 leading-relaxed">
        By clicking continue, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
}
