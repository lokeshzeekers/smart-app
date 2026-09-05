import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import RegisterPersonModal from '../../components/RegisterPersonModal';

interface TrainerRow {
  id: string;
  full_name: string;
  email: string;
  trainee_count: number;
  created_at: string;
}

export default function AdminDashboard() {
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  function loadTrainers() {
    setLoading(true);
    api.get('/admin/trainers').then(({ data }) => {
      setTrainers(data.trainers);
      setLoading(false);
    });
  }

  useEffect(loadTrainers, []);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-10">
      <header className="pt-6 pb-4 px-5 flex items-center justify-between">
        <h1 className="font-display font-semibold text-lg text-ink-900">Trainers</h1>
        <button
          onClick={() => {
            logout();
            navigate('/trainer/login');
          }}
          className="text-sm text-ink-500"
        >
          Sign out
        </button>
      </header>

      <div className="px-5 mb-4">
        <button
          onClick={() => setShowRegister(true)}
          className="w-full bg-brand-700 text-white rounded-xl py-3 font-medium text-[15px] hover:bg-brand-600 transition"
        >
          + Register a trainer
        </button>
      </div>

      <div className="px-5 space-y-3">
        {loading && <p className="text-ink-300 text-sm text-center py-8">Loading trainers…</p>}

        {!loading && trainers.length === 0 && (
          <p className="text-ink-300 text-sm text-center py-8">No trainers registered yet.</p>
        )}

        {trainers.map((t) => (
          <div key={t.id} className="bg-surface-card rounded-2xl p-4 shadow-card flex items-center justify-between">
            <div>
              <p className="text-[15px] font-medium text-ink-900">{t.full_name}</p>
              <p className="text-xs text-ink-300">{t.email}</p>
            </div>
            <span className="text-xs text-ink-500">{t.trainee_count} trainee{t.trainee_count === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>

      {showRegister && (
        <RegisterPersonModal
          title="Register a trainer"
          emailPlaceholder="trainer@institution.edu"
          onClose={() => setShowRegister(false)}
          onSubmit={async (email, fullName) => {
            await api.post('/admin/trainers', { email, fullName });
            loadTrainers();
          }}
        />
      )}
    </div>
  );
}
