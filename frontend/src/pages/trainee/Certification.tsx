import { useEffect, useState } from 'react';
import ModeHeader from '../../components/ModeHeader';
import BottomNav from '../../components/BottomNav';
import api from '../../api/client';
import { downloadFile } from '../../api/download';
import { useLiveSession } from '../../hooks/useLiveSession';
import { useOrStartSession } from '../../hooks/useOrStartSession';

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
  const { sessionId, starting } = useOrStartSession('certification');
  const { metrics: liveMetrics } = useLiveSession(sessionId);
  const [history, setHistory] = useState<any[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/trainee/certifications').then(({ data }) => setHistory(data.certifications));
  }, []);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadFile('/trainee/records/export', 'smart-records.csv');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24">
      <ModeHeader title="SMArT - Certification" />
      <div className="px-5 space-y-4">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2 bg-surface-card border border-surface-border rounded-xl py-3 text-sm font-medium text-ink-700 hover:bg-surface-muted transition disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {downloading ? 'Preparing…' : 'Download my records (CSV)'}
        </button>

        {starting ? (
          <p className="text-ink-300 text-sm text-center py-6">Starting trial…</p>
        ) : (
          sessionId && <TrialCard label="Current Trial" metrics={liveMetrics} />
        )}

        {history.map((cert) =>
          cert.trials.map((t: any) => (
            <TrialCard key={t.session_id} label={`Trial ${t.trial_no}`} metrics={t} />
          ))
        )}

        {!starting && history.length === 0 && (
          <p className="text-ink-300 text-sm text-center py-10">No past certification trials yet — this one just started.</p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
