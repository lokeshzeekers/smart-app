import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';

export default function TrainerBottomNav({ notifCount = 0 }: { notifCount?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const Icon = ({ d }: { d: string }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-surface-border px-7 py-3 flex justify-between items-center max-w-md mx-auto">
      <NavLink to="/trainer/dashboard" className={({ isActive }) => (isActive ? 'text-brand-700' : 'text-ink-300')}>
        <Icon d="M3 11.5L12 4l9 7.5M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
      </NavLink>

      <button
        onClick={() => navigate('/trainer/dashboard', { state: { focusSearch: true, at: Date.now() } })}
        className="text-ink-300"
        aria-label="Search trainees"
      >
        <Icon d="M11 17.5A6.5 6.5 0 1011 4.5a6.5 6.5 0 000 13zM20 20l-3.8-3.8" />
      </button>

      <button
        onClick={() => navigate('/trainer/dashboard', { state: { register: true, at: Date.now() } })}
        className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-white"
        aria-label="Register a trainee"
      >
        <Icon d="M12 5v14M5 12h14" />
      </button>

      <NavLink to="/trainer/reviews" className={({ isActive }) => `relative ${isActive ? 'text-brand-700' : 'text-ink-300'}`}>
        <Icon d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
        {notifCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-status-fail text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
            {notifCount}
          </span>
        )}
      </NavLink>

      <button
        onClick={() => setShowProfile(true)}
        className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-medium overflow-hidden"
        aria-label="View profile"
      >
        {user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : user?.full_name?.[0]?.toUpperCase()}
      </button>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </nav>
  );
}
