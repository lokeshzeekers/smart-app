import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
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
  laryngoscope_lift_force: number | null;
  time_to_place_ett: number | null;
  ett_location_cm: number | null;
  total_time_to_intubate: number | null;
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
}

export default function TraineePerformance() {
  const { traineeId } = useParams();
  const navigate = useNavigate();
  const [trainee, setTrainee] = useState<TraineeInfo | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/trainer/trainees/${traineeId}/performance`).then(({ data }) => {
      setTrainee(data.trainee);
      setSessions(data.sessions);
      setLoading(false);
    });
  }, [traineeId]);

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
          <div className="px-5 flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-lg overflow-hidden">
              {trainee.avatar_url ? <img src={trainee.avatar_url} className="w-full h-full object-cover" /> : trainee.full_name[0]}
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg text-ink-900">{trainee.full_name}</h1>
              <p className="text-sm text-ink-300">{trainee.email}</p>
            </div>
          </div>

          <div className="px-5 space-y-3">
            <h2 className="text-sm font-medium text-ink-500 mb-1">Session history</h2>

            {sessions.length === 0 && (
              <p className="text-ink-300 text-sm text-center py-8">No sessions recorded yet.</p>
            )}

            {sessions.map((s) => (
              <div key={s.session_id} className="bg-surface-card rounded-2xl p-4 shadow-card">
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
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-ink-300 text-sm text-center py-8">Trainee not found.</p>
      )}
    </div>
  );
}
