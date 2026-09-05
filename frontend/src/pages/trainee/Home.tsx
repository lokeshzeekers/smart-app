import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import BottomNav from '../../components/BottomNav';
import ProfileModal from '../../components/ProfileModal';

const modes = [
  {
    key: 'coach',
    title: 'Coach',
    desc: 'Step-by-step live guidance while you practice on the manikin.',
    color: 'bg-brand-700',
  },
  {
    key: 'check',
    title: 'Check',
    desc: 'Run a graded attempt and see your measured metrics.',
    color: 'bg-brand-600',
  },
  {
    key: 'certification',
    title: 'Certification',
    desc: 'Formal trials that count toward your certification record.',
    color: 'bg-brand-900',
  },
];

interface Summary {
  latest: {
    mode: string;
    completed_at: string;
    smart_score: number | null;
    ai_suggestion: 'pass' | 'bad_technique' | 'fail' | null;
    trainer_final_verdict: 'pass' | 'bad_technique' | 'fail' | null;
  } | null;
  totalSessions: number;
}

export default function TraineeHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    api.get('/trainee/summary').then(({ data }) => setSummary(data));
  }, []);

  async function startMode(mode: string) {
    const { data } = await api.post('/trainee/sessions', { mode });
    navigate(`/trainee/${mode}`, { state: { sessionId: data.session.id } });
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24">
      <header className="pt-6 pb-2 px-5 flex items-center justify-between">
        <div>
          <p className="text-ink-500 text-sm">Welcome back,</p>
          <h1 className="font-display font-semibold text-xl text-ink-900">{user?.full_name}</h1>
        </div>
        <button
          onClick={() => setShowProfile(true)}
          className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium overflow-hidden"
          aria-label="View profile"
        >
          {user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : user?.full_name?.[0]?.toUpperCase()}
        </button>
      </header>

      {summary && (
        <div className="px-5 mt-4">
          <div className="bg-surface-card rounded-2xl p-4 shadow-card flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-300 mb-0.5">Your progress</p>
              <p className="text-[15px] font-medium text-ink-900">
                {summary.totalSessions} session{summary.totalSessions === 1 ? '' : 's'} completed
              </p>
            </div>
            {summary.latest?.smart_score != null && (
              <div className="text-right">
                <p className="text-xs text-ink-300 mb-0.5">Last score</p>
                <p className="font-mono text-lg font-semibold text-brand-700">{summary.latest.smart_score}/10</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-5 mt-4 space-y-4">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => startMode(m.key)}
            className="w-full text-left bg-surface-card rounded-2xl p-5 shadow-card hover:-translate-y-0.5 transition"
          >
            <div className={`w-10 h-10 rounded-xl ${m.color} mb-3`} />
            <h3 className="font-display font-semibold text-base text-ink-900">{m.title}</h3>
            <p className="text-ink-500 text-sm mt-1 leading-relaxed">{m.desc}</p>
          </button>
        ))}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      <BottomNav />
    </div>
  );
}
