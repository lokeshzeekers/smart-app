import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import TrainerBottomNav from '../../components/TrainerBottomNav';
import RegisterPersonModal from '../../components/RegisterPersonModal';
import VerdictBadge from '../../components/VerdictBadge';

interface TraineeRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_verified: boolean;
  smart_score: number | null;
  ai_suggestion: 'pass' | 'bad_technique' | 'fail' | null;
  mode: string | null;
}

export default function TrainerDashboard() {
  const [trainees, setTrainees] = useState<TraineeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<TraineeRow | null>(null);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // TrainerBottomNav's "+" and search buttons navigate here with fresh
  // location.state each time (a unique "at" timestamp), so this fires on
  // every tap even when we're already on this page - not just on first mount.
  useEffect(() => {
    const state = location.state as { register?: boolean; focusSearch?: boolean } | null;
    if (!state) return;
    if (state.register) setShowRegister(true);
    if (state.focusSearch) searchRef.current?.focus();
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function loadTrainees() {
    setLoading(true);
    api.get('/trainer/trainees').then(({ data }) => {
      setTrainees(data.trainees);
      setLoading(false);
    });
  }

  useEffect(loadTrainees, []);

  async function handleRemove() {
    if (!confirmRemove) return;
    await api.delete(`/trainer/trainees/${confirmRemove.id}`);
    setConfirmRemove(null);
    loadTrainees();
  }

  const filtered = trainees.filter(
    (t) => t.full_name.toLowerCase().includes(search.toLowerCase()) || t.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24">
      <header className="pt-6 pb-4 px-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display font-semibold text-lg text-ink-900">My Trainees</h1>
          <button
            onClick={() => setShowRegister(true)}
            className="bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-brand-600 transition"
          >
            + Register
          </button>
        </div>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="w-full border border-surface-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </header>

      <div className="px-5 space-y-3">
        {loading && <p className="text-ink-300 text-sm text-center py-8">Loading your trainees…</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-ink-300 text-sm text-center py-8">
            {trainees.length === 0 ? 'No trainees registered yet — tap "+ Register" to add one.' : 'No matches.'}
          </p>
        )}

        {filtered.map((t) => (
          <div key={t.id} className="w-full bg-surface-card rounded-2xl p-4 shadow-card flex items-center gap-3">
            <button onClick={() => navigate(`/trainer/trainees/${t.id}`)} className="flex-1 flex items-center gap-3 text-left min-w-0">
              <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium overflow-hidden shrink-0">
                {t.avatar_url ? <img src={t.avatar_url} className="w-full h-full object-cover" /> : t.full_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-ink-900 truncate">{t.full_name}</p>
                <p className="text-xs text-ink-300 truncate">{t.email}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {t.ai_suggestion ? (
                  <VerdictBadge verdict={t.ai_suggestion} />
                ) : (
                  <span className="text-xs text-ink-300">{t.is_verified ? 'No sessions yet' : 'Not yet signed in'}</span>
                )}
                {t.smart_score != null && <span className="text-xs text-ink-500">Score: {t.smart_score}</span>}
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmRemove(t);
              }}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-status-fail hover:bg-status-failBg transition"
              aria-label={`Remove ${t.full_name}`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10zM10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      {showRegister && (
        <RegisterPersonModal
          title="Register a trainee"
          emailPlaceholder="trainee@institution.edu"
          onClose={() => setShowRegister(false)}
          onSubmit={async (email, fullName) => {
            await api.post('/trainer/trainees', { email, fullName });
            loadTrainees();
          }}
        />
      )}

      {confirmRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <h2 className="font-display font-semibold text-lg text-ink-900 mb-2">Remove trainee?</h2>
            <p className="text-sm text-ink-500 mb-6">
              <b>{confirmRemove.full_name}</b> will lose access and drop off your roster. Their past session and
              certification records are kept, not deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 bg-surface-muted text-ink-700 rounded-xl py-3 font-medium text-[15px]"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                className="flex-1 bg-status-fail text-white rounded-xl py-3 font-medium text-[15px] hover:opacity-90 transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <TrainerBottomNav />
    </div>
  );
}
