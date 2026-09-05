import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';

const modes = [
  { key: 'coach', label: 'Coach', path: '/trainee/coach' },
  { key: 'check', label: 'Check', path: '/trainee/check' },
  { key: 'certification', label: 'Certification', path: '/trainee/certification' },
];

export default function ModeHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <header className="sticky top-0 bg-surface pt-5 pb-4 px-5 z-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-semibold text-lg text-ink-900">{title}</h1>
        <button
          onClick={() => setShowProfile(true)}
          className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-sm overflow-hidden"
          aria-label="View profile"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} className="w-full h-full object-cover" />
          ) : (
            user?.full_name?.[0]?.toUpperCase() || 'U'
          )}
        </button>
      </div>
      <div className="flex bg-surface-muted rounded-xl p-1 gap-1">
        {modes.map((m) => {
          const active = location.pathname === m.path;
          return (
            <button
              key={m.key}
              onClick={() => navigate(m.path)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                active ? 'bg-brand-700 text-white shadow-card' : 'text-ink-500'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </header>
  );
}
