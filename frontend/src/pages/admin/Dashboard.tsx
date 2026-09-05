import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import RegisterPersonModal from '../../components/RegisterPersonModal';
import RegisterDeviceModal from '../../components/RegisterDeviceModal';

interface TrainerRow {
  id: string;
  full_name: string;
  email: string;
  trainee_count: number;
  created_at: string;
}

interface DeviceRow {
  id: string;
  device_uid: string;
  label: string;
  last_seen_at: string | null;
  is_active: boolean;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<'trainers' | 'devices'>('trainers');
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterTrainer, setShowRegisterTrainer] = useState(false);
  const [showRegisterDevice, setShowRegisterDevice] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  function loadTrainers() {
    setLoading(true);
    api.get('/admin/trainers').then(({ data }) => {
      setTrainers(data.trainers);
      setLoading(false);
    });
  }

  function loadDevices() {
    setLoading(true);
    api.get('/admin/devices').then(({ data }) => {
      setDevices(data.devices);
      setLoading(false);
    });
  }

  useEffect(() => {
    tab === 'trainers' ? loadTrainers() : loadDevices();
  }, [tab]);

  function timeAgo(iso: string | null) {
    if (!iso) return 'Never connected';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-10">
      <header className="pt-6 pb-4 px-5 flex items-center justify-between">
        <h1 className="font-display font-semibold text-lg text-ink-900">Admin</h1>
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

      <div className="px-5 mb-4 flex bg-surface-muted rounded-xl p-1 gap-1">
        <button
          onClick={() => setTab('trainers')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === 'trainers' ? 'bg-brand-700 text-white shadow-card' : 'text-ink-500'}`}
        >
          Trainers
        </button>
        <button
          onClick={() => setTab('devices')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === 'devices' ? 'bg-brand-700 text-white shadow-card' : 'text-ink-500'}`}
        >
          Manikins
        </button>
      </div>

      <div className="px-5 mb-4">
        <button
          onClick={() => (tab === 'trainers' ? setShowRegisterTrainer(true) : setShowRegisterDevice(true))}
          className="w-full bg-brand-700 text-white rounded-xl py-3 font-medium text-[15px] hover:bg-brand-600 transition"
        >
          {tab === 'trainers' ? '+ Register a trainer' : '+ Register a manikin'}
        </button>
      </div>

      {tab === 'trainers' ? (
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
      ) : (
        <div className="px-5 space-y-3">
          {loading && <p className="text-ink-300 text-sm text-center py-8">Loading manikins…</p>}
          {!loading && devices.length === 0 && (
            <p className="text-ink-300 text-sm text-center py-8">No manikins registered yet.</p>
          )}
          {devices.map((d) => (
            <div key={d.id} className="bg-surface-card rounded-2xl p-4 shadow-card flex items-center justify-between">
              <div>
                <p className="text-[15px] font-medium text-ink-900">{d.label}</p>
                <p className="text-xs text-ink-300 font-mono">{d.device_uid}</p>
              </div>
              <span className={`text-xs ${d.last_seen_at ? 'text-status-pass' : 'text-ink-300'}`}>{timeAgo(d.last_seen_at)}</span>
            </div>
          ))}
        </div>
      )}

      {showRegisterTrainer && (
        <RegisterPersonModal
          title="Register a trainer"
          emailPlaceholder="trainer@institution.edu"
          onClose={() => setShowRegisterTrainer(false)}
          onSubmit={async (email, fullName) => {
            await api.post('/admin/trainers', { email, fullName });
            loadTrainers();
          }}
        />
      )}

      {showRegisterDevice && (
        <RegisterDeviceModal onClose={() => setShowRegisterDevice(false)} onCreated={loadDevices} />
      )}
    </div>
  );
}
