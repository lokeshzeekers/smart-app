import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (params.get('register') === '1') {
      setShowRegister(true);
      params.delete('register');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadTrainees() {
    setLoading(true);
    api.get('/trainer/trainees').then(({ data }) => {
      setTrainees(data.trainees);
      setLoading(false);
    });
  }

  useEffect(loadTrainees, []);

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
          <button
            key={t.id}
            onClick={() => navigate(`/trainer/trainees/${t.id}`)}
            className="w-full bg-surface-card rounded-2xl p-4 shadow-card flex items-center gap-3 text-left"
          >
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

      <TrainerBottomNav />
    </div>
  );
}
