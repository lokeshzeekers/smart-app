import ModeHeader from '../../components/ModeHeader';
import StepList from '../../components/StepList';
import BottomNav from '../../components/BottomNav';
import LiveTelemetryPanel from '../../components/LiveTelemetryPanel';
import { useLiveSession } from '../../hooks/useLiveSession';
import { useOrStartSession } from '../../hooks/useOrStartSession';

export default function Coach() {
  const { sessionId, starting } = useOrStartSession('coach');
  const { steps, loading, telemetry } = useLiveSession(sessionId);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24">
      <ModeHeader title="SMArT - Coach" />
      <div className="px-5">
        <LiveTelemetryPanel telemetry={telemetry} />
        {starting || loading ? (
          <p className="text-ink-300 text-sm py-8 text-center">Starting session…</p>
        ) : (
          <div className="bg-surface-card rounded-2xl px-5 shadow-card">
            <StepList steps={steps} />
          </div>
        )}
        <p className="text-xs text-ink-300 text-center mt-4">
          Dots light up green in real time as the manikin's sensors confirm each step.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
