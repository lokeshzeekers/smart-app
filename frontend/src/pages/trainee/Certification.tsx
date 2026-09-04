import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ModeHeader from '../../components/ModeHeader';
import BottomNav from '../../components/BottomNav';
import api from '../../api/client';
import { useLiveSession } from '../../hooks/useLiveSession';

function TrialCard({ label, metrics }: { label: string; metrics: any }) {
  return (
    <div className="bg-surface-card rounded-2xl p-5 shadow-card">
      <p className="font-display font-semibold text-sm text-brand-700 mb-3">{label}</p>
      <div className="grid grid-cols-2 gap-y-2.5 text-sm">
        <span className="text-ink-500">Laryngoscope lift force</span>
        <span className="text-right font-medium text-ink-900">{metrics?.laryngoscope_lift_force ?? '—'}psi</span>
        <span className="text-ink-500">Time to place ETT</span>
        <span className="text-right font-medium text-ink-900">{metrics?.time_to_place_ett ?? '—'}s</span>
        <span className="text-ink-500">ETT Location</span>
        <span className="text-right font-medium text-ink-900">{metrics?.ett_location_cm ?? '—'}cm</span>
        <span className="text-ink-500">Total time to intubate</span>
        <span className="text-right font-medium text-ink-900">{metrics?.total_time_to_intubate ?? '—'}s</span>
      </div>
    </div>
  );
}

export default function Certification() {
  const { state } = useLocation() as { state?: { sessionId?: string } };
  const { metrics: liveMetrics } = useLiveSession(state?.sessionId);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    api.get('/trainee/certifications').then(({ data }) => setHistory(data.certifications));
  }, []);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24">
      <ModeHeader title="SMArT - Certification" />
      <div className="px-5 space-y-4">
        {state?.sessionId && <TrialCard label="Current Trial" metrics={liveMetrics} />}

        {history.map((cert) =>
          cert.trials.map((t: any) => (
            <TrialCard key={t.session_id} label={`Trial ${t.trial_no}`} metrics={t} />
          ))
        )}

        {!state?.sessionId && history.length === 0 && (
          <p className="text-ink-300 text-sm text-center py-10">No certification trials yet. Start one from Home.</p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
