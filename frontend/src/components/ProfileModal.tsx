import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const canChangePassword = user?.role === 'trainer' || user?.role === 'admin';

  function handleLogout() {
    logout();
    onClose();
    navigate(user?.role === 'trainee' ? '/' : '/trainer/login');
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 8) return setPwError('New password must be at least 8 characters');
    setSaving(true);
    try {
      await api.patch('/auth/me/password', { currentPassword, newPassword });
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xl overflow-hidden mb-3">
            {user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : user?.full_name?.[0]?.toUpperCase()}
          </div>
          <h2 className="font-display font-semibold text-lg text-ink-900">{user?.full_name}</h2>
          <p className="text-sm text-ink-300">{user?.email}</p>
          <span className="mt-2 text-xs font-medium uppercase tracking-wide text-brand-700 bg-brand-100 px-2.5 py-1 rounded-full">
            {user?.role}
          </span>
        </div>

        {canChangePassword && !showChangePassword && (
          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full mb-3 border border-surface-border rounded-xl py-3 font-medium text-[15px] text-ink-700 hover:bg-surface-muted transition"
          >
            Change password
          </button>
        )}

        {canChangePassword && showChangePassword && (
          <form onSubmit={handleChangePassword} className="space-y-3 mb-4">
            {pwSuccess ? (
              <p className="text-sm text-status-pass bg-status-passBg rounded-xl px-4 py-3">Password updated.</p>
            ) : (
              <>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full border border-surface-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  className="w-full border border-surface-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                {pwError && <p className="text-status-fail text-sm">{pwError}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-brand-700 text-white rounded-xl py-2.5 font-medium text-sm hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Update password'}
                </button>
              </>
            )}
          </form>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-surface-muted text-ink-700 rounded-xl py-3 font-medium text-[15px]">
            Close
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 bg-status-fail text-white rounded-xl py-3 font-medium text-[15px] hover:opacity-90 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
