import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import { downloadFile } from '../../api/download';
import VerdictBadge from '../../components/VerdictBadge';

interface SessionRow {
  session_id: string;
  mode: string;
  trial_no: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  steps_passed: number | null;
  steps_total: number | null;
  evaluation_id: string | null;
  smart_score: number | null;
  ai_suggestion: 'pass' | 'bad_technique' | 'fail' | null;
  review_status: string | null;
  trainer_final_verdict: 'pass' | 'bad_technique' | 'fail' | null;
}

interface TraineeInfo {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  assigned_device_id: string | null;
  assigned_device_label: string | null;
}

interface Device {
  id: string;
  device_uid: string;
  label: string;
}

export default function TraineePerformance() {
  const { traineeId } = useParams();
  const navigate = useNavigate();
  const [trainee, setTrainee] = useState<TraineeInfo | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [savingDevice, setSavingDevice] = useState(false);

  function load() {
    setLoading(true);
    return Promise.all([
      api.get(`/trainer/trainees/${traineeId}/performance`).then(({ data }) => {
        setTrainee(data.trainee);
        setSessions(data.sessions);
      }),
      api.get('/trainer/devices').then(({ data }) => setDevices(data.devices)),
    ]).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traineeId]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadFile(`/trainer/trainees/${traineeId}/records/export`, 'smart-records.csv');
    } finally {
      setDownloading(false);
    }
  }

  async function handleDeviceChange(deviceId: string) {
    setSavingDevice(true);
    try {
      await api.patch(`/trainer/trainees/${traineeId}/device`, { deviceId: deviceId || null });
      await load();
    } finally {
      setSavingDevice(false);
    }
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-10">
      <header className="pt-6 pb-4 px-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-ink-500 text-sm">
          ← Back
        </button>
      </header>

      {loading ? (
        <p className="text-ink-300 text-sm text-center py-8">Loading…</p>
      ) : trainee ? (
        <>
          <div className="px-5 flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-lg overflow-hidden">
              {trainee.avatar_url ? <img src={trainee.avatar_url} className="w-full h-full object-cover" /> : trainee.full_name[0]}
            </div>
            <div className="flex-1">
              <h1 className="font-display font-semibold text-lg text-ink-900">{trainee.full_name}</h1>
              <p className="text-sm text-ink-300">{trainee.email}</p>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="shrink-0 flex items-center gap-1.5 border border-surface-border rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-surface-muted transition disabled:opacity-60"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {downloading ? 'Preparing…' : 'CSV'}
            </button>
          </div>

          <div className="px-5 mb-6">
            <p className="text-xs text-ink-300 mb-1.5">Manikin assigned to this trainee</p>
            <select
              value={trainee.assigned_device_id || ''}
              onChange={(e) => handleDeviceChange(e.target.value)}
              disabled={savingDevice}
              className="w-full border border-surface-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 disabled:opacity-60"
            >
              <option value="">Not pinned — sees all your available manikins</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            {devices.length === 0 && (
              <p className="text-xs text-ink-300 mt-1.5">
                No manikins available to you yet — ask an admin to assign one to you.
              </p>
            )}
          </div>

          <div className="px-5 space-y-3">
            <h2 className="text-sm font-medium text-ink-500 mb-1">Session history</h2>

            {sessions.length === 0 && (
              <p className="text-ink-300 text-sm text-center py-8">No sessions recorded yet.</p>
            )}

            {sessions.map((s) => {
              const clickable = !!s.evaluation_id;
              return (
                <button
                  key={s.session_id}
                  onClick={() => clickable && navigate(`/trainer/review/${s.evaluation_id}`)}
                  disabled={!clickable}
                  className={`w-full text-left bg-surface-card rounded-2xl p-4 shadow-card ${clickable ? 'hover:-translate-y-0.5 transition cursor-pointer' : 'opacity-70 cursor-default'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[15px] font-medium text-ink-900 capitalize">
                      {s.mode} {s.mode === 'certification' ? `· Trial ${s.trial_no}` : ''}
                    </span>
                    {s.ai_suggestion && <VerdictBadge verdict={s.trainer_final_verdict || s.ai_suggestion} />}
                  </div>
                  <p className="text-xs text-ink-300 mb-2">
                    {new Date(s.started_at).toLocaleString()} · {s.status}
                  </p>
                  {s.steps_total != null && (
                    <p className="text-xs text-ink-500 mb-1">
                      Steps passed: {s.steps_passed}/{s.steps_total}
                    </p>
                  )}
                  {s.smart_score != null && <p className="text-xs text-ink-500">SMArT score: {s.smart_score}/10</p>}
                  {clickable ? (
                    <p className="text-xs text-brand-700 font-medium mt-2">View full details & coaching notes →</p>
                  ) : (
                    <p className="text-xs text-ink-300 mt-2">Not evaluated yet</p>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-ink-300 text-sm text-center py-8">Trainee not found.</p>
      )}
    </div>
  );
}
