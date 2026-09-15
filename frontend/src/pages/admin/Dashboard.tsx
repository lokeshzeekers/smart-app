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
  assigned_trainer_id: string | null;
  assigned_trainer_name: string | null;
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10zM10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<'trainers' | 'devices'>('trainers');
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterTrainer, setShowRegisterTrainer] = useState(false);
  const [showRegisterDevice, setShowRegisterDevice] = useState(false);
  const [confirmRemoveTrainer, setConfirmRemoveTrainer] = useState<TrainerRow | null>(null);
  const [confirmRemoveDevice, setConfirmRemoveDevice] = useState<DeviceRow | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  function loadTrainers() {
    return api.get('/admin/trainers').then(({ data }) => setTrainers(data.trainers));
  }

  function loadDevices() {
    return api.get('/admin/devices').then(({ data }) => setDevices(data.devices));
  }

  useEffect(() => {
    setLoading(true);
    // Trainers are always fetched too - the device tab's "assign to
    // trainer" dropdown needs the list regardless of which tab is active.
    Promise.all([loadTrainers(), loadDevices()]).finally(() => setLoading(false));
  }, []);

  async function handleRemoveTrainer() {
    if (!confirmRemoveTrainer) return;
    await api.delete(`/admin/trainers/${confirmRemoveTrainer.id}`);
    setConfirmRemoveTrainer(null);
    loadTrainers();
  }

  async function handleRemoveDevice() {
    if (!confirmRemoveDevice) return;
    await api.delete(`/admin/devices/${confirmRemoveDevice.id}`);
    setConfirmRemoveDevice(null);
    loadDevices();
  }

  const [assignError, setAssignError] = useState('');

  async function handleAssign(deviceId: string, trainerId: string) {
    setAssignError('');
    try {
      await api.patch(`/admin/devices/${deviceId}/assign`, { trainerId: trainerId || null });
      await loadDevices();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to assign device:', err);
      setAssignError(err.response?.data?.error || 'Failed to assign this manikin - check the backend log.');
    }
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
            <div key={t.id} className="bg-surface-card rounded-2xl p-4 shadow-card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-ink-900 truncate">{t.full_name}</p>
                <p className="text-xs text-ink-300 truncate">{t.email}</p>
              </div>
              <span className="text-xs text-ink-500 shrink-0">{t.trainee_count} trainee{t.trainee_count === 1 ? '' : 's'}</span>
              <button
                onClick={() => setConfirmRemoveTrainer(t)}
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-status-fail hover:bg-status-failBg transition"
                aria-label={`Remove ${t.full_name}`}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 space-y-3">
          {loading && <p className="text-ink-300 text-sm text-center py-8">Loading manikins…</p>}
          {assignError && <p className="text-status-fail text-sm bg-status-failBg rounded-xl px-4 py-2.5">{assignError}</p>}
          {!loading && devices.length === 0 && (
            <p className="text-ink-300 text-sm text-center py-8">No manikins registered yet.</p>
          )}
          {devices.map((d) => (
            <div key={d.id} className="bg-surface-card rounded-2xl p-4 shadow-card space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-ink-900 truncate">{d.label}</p>
                  <p className="text-xs text-ink-300 font-mono truncate">{d.device_uid}</p>
                </div>
                <button
                  onClick={() => setConfirmRemoveDevice(d)}
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-status-fail hover:bg-status-failBg transition"
                  aria-label={`Remove ${d.label}`}
                >
                  <TrashIcon />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <select
                  value={d.assigned_trainer_id || ''}
                  onChange={(e) => handleAssign(d.id, e.target.value)}
                  className="flex-1 border border-surface-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand-500"
                >
                  <option value="">Unassigned (visible to everyone)</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-ink-300 shrink-0">{d.last_seen_at ? 'Connected' : 'Never connected'}</span>
              </div>
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

      {confirmRemoveTrainer && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <h2 className="font-display font-semibold text-lg text-ink-900 mb-2">Remove trainer?</h2>
            <p className="text-sm text-ink-500 mb-6">
              <b>{confirmRemoveTrainer.full_name}</b> loses access immediately. Their trainees and past records stay intact -
              re-registering this same email later restores everything.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemoveTrainer(null)} className="flex-1 bg-surface-muted text-ink-700 rounded-xl py-3 font-medium text-[15px]">
                Cancel
              </button>
              <button onClick={handleRemoveTrainer} className="flex-1 bg-status-fail text-white rounded-xl py-3 font-medium text-[15px] hover:opacity-90 transition">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveDevice && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
            <h2 className="font-display font-semibold text-lg text-ink-900 mb-2">Remove manikin?</h2>
            <p className="text-sm text-ink-500 mb-6">
              <b>{confirmRemoveDevice.label}</b> will stop accepting connections and disappear from every trainee's picker.
              Past session records stay intact. To bring it back online later you'll need to register it again with new credentials.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemoveDevice(null)} className="flex-1 bg-surface-muted text-ink-700 rounded-xl py-3 font-medium text-[15px]">
                Cancel
              </button>
              <button onClick={handleRemoveDevice} className="flex-1 bg-status-fail text-white rounded-xl py-3 font-medium text-[15px] hover:opacity-90 transition">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
