import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    onClose();
    navigate(user?.role === 'trainee' ? '/' : '/trainer/login');
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
