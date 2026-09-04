import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import StepList from '../../components/StepList';
import VerdictBadge from '../../components/VerdictBadge';

type Verdict = 'pass' | 'bad_technique' | 'fail';

export default function TrainerReview() {
  const { evaluationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/trainer/evaluations/${evaluationId}`).then((res) => setData(res.data));
  }, [evaluationId]);

  async function decide(verdict: Verdict) {
    setSubmitting(true);
    try {
      await api.post(`/trainer/evaluations/${evaluationId}/review`, { verdict, comments });
      navigate('/trainer/dashboard');
    } finally {
      setSubmitting(false);
    }
  }

  if (!data) return <p className="text-center text-ink-300 text-sm py-16">Loading…</p>;

  const { evaluation, steps, metrics } = data;

  return (
    <div className="min-h-screen max-w-md mx-auto pb-10">
      <header className="pt-6 pb-4 px-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-ink-500">
          ←
        </button>
        <div>
          <h1 className="font-display font-semibold text-base text-ink-900">{evaluation.full_name}</h1>
          <p className="text-xs text-ink-300">
            {evaluation.mode} · Trial {evaluation.trial_no} · Score {evaluation.smart_score}/10
          </p>
        </div>
      </header>

      <div className="px-5 space-y-4">
        <div className="bg-surface-card rounded-2xl p-4 shadow-card flex items-center justify-between">
          <span className="text-sm text-ink-500">AI Suggestion</span>
          <VerdictBadge verdict={evaluation.ai_suggestion} />
        </div>
        {evaluation.ai_notes && (
          <p className="text-sm text-ink-500 bg-surface-muted rounded-xl px-4 py-3">{evaluation.ai_notes}</p>
        )}

        <div className="bg-surface-card rounded-2xl px-5 shadow-card">
          <StepList steps={steps} numbered={false} />
        </div>

        <div className="bg-surface-card rounded-2xl p-5 shadow-card grid grid-cols-2 gap-y-2.5 text-sm">
          <span className="text-ink-500">Laryngoscope lift force</span>
          <span className="text-right font-medium">{metrics?.laryngoscope_lift_force ?? '—'}psi</span>
          <span className="text-ink-500">Time to place ETT</span>
          <span className="text-right font-medium">{metrics?.time_to_place_ett ?? '—'}s</span>
          <span className="text-ink-500">ETT Location</span>
          <span className="text-right font-medium">{metrics?.ett_location_cm ?? '—'}cm</span>
          <span className="text-ink-500">Total time to intubate</span>
          <span className="text-right font-medium">{metrics?.total_time_to_intubate ?? '—'}s</span>
        </div>

        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Add review comments (optional)"
          rows={3}
          className="w-full border border-surface-border rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            disabled={submitting}
            onClick={() => decide('pass')}
            className="py-3 rounded-xl bg-status-passBg text-status-pass font-medium text-sm"
          >
            Pass
          </button>
          <button
            disabled={submitting}
            onClick={() => decide('bad_technique')}
            className="py-3 rounded-xl bg-status-badBg text-status-bad font-medium text-sm"
          >
            Bad Technique
          </button>
          <button
            disabled={submitting}
            onClick={() => decide('fail')}
            className="py-3 rounded-xl bg-status-failBg text-status-fail font-medium text-sm"
          >
            Fail
          </button>
        </div>
      </div>
    </div>
  );
}
