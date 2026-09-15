import { useState } from 'react';

interface Props {
  title: string;
  emailPlaceholder: string;
  includePassword?: boolean;
  onSubmit: (email: string, fullName: string, password?: string) => Promise<void>;
  onClose: () => void;
}

export default function RegisterPersonModal({ title, emailPlaceholder, includePassword, onSubmit, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (includePassword && password && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(email, fullName, includePassword ? password || undefined : undefined);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
        <h2 className="font-display font-semibold text-lg text-ink-900 mb-4">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-ink-500 mb-1.5 block">Full name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full border border-surface-border rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="text-sm text-ink-500 mb-1.5 block">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailPlaceholder}
              className="w-full border border-surface-border rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {includePassword && (
            <div>
              <label className="text-sm text-ink-500 mb-1.5 block">Password (optional)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to auto-generate & email"
                  className="w-full border border-surface-border rounded-xl px-4 py-3 pr-11 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M3 3l18 18M10.6 10.7a2.5 2.5 0 003.5 3.5M6.6 6.7C4.5 8.1 3 10 3 12c0 0 3.5 6.5 9 6.5 1.7 0 3.2-.5 4.4-1.3M9.6 5.2A10.9 10.9 0 0112 5c5.5 0 9 6.5 9 6.5-.5.9-1.3 2-2.3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-ink-300 mt-1.5">
                Set one yourself so they can log in immediately — useful if email delivery isn't set up.
              </p>
            </div>
          )}
          {error && <p className="text-status-fail text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-muted text-ink-700 rounded-xl py-3 font-medium text-[15px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-700 text-white rounded-xl py-3 font-medium text-[15px] hover:bg-brand-600 transition disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
