import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import BottomNav from '../../components/BottomNav';

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

export default function TraineeHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        <button onClick={logout} className="text-xs text-ink-300 underline">
          Sign out
        </button>
      </header>

      <div className="px-5 mt-6 space-y-4">
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

      <BottomNav />
    </div>
  );
}
