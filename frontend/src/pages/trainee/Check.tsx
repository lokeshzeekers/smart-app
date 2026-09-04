import { useLocation } from 'react-router-dom';
import ModeHeader from '../../components/ModeHeader';
import StepList from '../../components/StepList';
import BottomNav from '../../components/BottomNav';
import { useLiveSession } from '../../hooks/useLiveSession';

function MetricRow({ label, value, unit }: { label: string; value: number | null | undefined; unit: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-medium text-ink-900 bg-surface-muted px-3 py-1 rounded-lg min-w-[64px] text-center">
        {value != null ? `${value}${unit}` : '—'}
      </span>
    </div>
  );
}

export default function Check() {
  const { state } = useLocation() as { state?: { sessionId?: string } };
  const { steps, metrics, loading } = useLiveSession(state?.sessionId);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24">
      <ModeHeader title="SMArT - Check" />
      <div className="px-5 space-y-4">
        {loading ? (
          <p className="text-ink-300 text-sm py-8 text-center">Loading steps…</p>
        ) : (
          <>
            <div className="bg-surface-card rounded-2xl px-5 shadow-card">
              <StepList steps={steps} numbered={false} />
            </div>
            <div className="bg-surface-card rounded-2xl px-5 py-2 shadow-card">
              <MetricRow label="Laryngoscope lift force" value={metrics?.laryngoscope_lift_force} unit="psi" />
              <MetricRow label="Time to place ETT" value={metrics?.time_to_place_ett} unit="s" />
              <MetricRow label="ETT Location" value={metrics?.ett_location_cm} unit="cm" />
              <MetricRow label="Total time to intubate" value={metrics?.total_time_to_intubate} unit="s" />
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
