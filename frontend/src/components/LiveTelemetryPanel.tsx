import { Telemetry } from '../hooks/useLiveSession';

const bannerStyles: Record<Telemetry['bannerType'], string> = {
  progress: 'bg-surface-muted text-ink-500 border-surface-border',
  wrong: 'bg-status-failBg text-status-fail border-status-fail',
  complete: 'bg-status-passBg text-status-pass border-status-pass',
};

function PathBadge({ wrongPath, correctPath }: { wrongPath: boolean; correctPath: boolean }) {
  if (wrongPath) return <span className="text-sm font-semibold text-status-fail">WRONG</span>;
  if (correctPath) return <span className="text-sm font-semibold text-status-pass">CORRECT</span>;
  return <span className="text-sm font-semibold text-ink-300">--</span>;
}

export default function LiveTelemetryPanel({ telemetry }: { telemetry: Telemetry | null }) {
  if (!telemetry) {
    return (
      <div className="bg-surface-card rounded-2xl p-4 shadow-card mb-4 text-center text-sm text-ink-300">
        Waiting for manikin connection…
      </div>
    );
  }

  const depthPct = Math.max(0, Math.min(100, ((telemetry.depthCm ?? 0) / 10) * 100));

  return (
    <div className="mb-4 space-y-3">
      <div className={`rounded-xl border px-4 py-2.5 text-center text-[13px] font-semibold tracking-wide ${bannerStyles[telemetry.bannerType]}`}>
        {telemetry.bannerMsg}
      </div>

      <div className="bg-surface-card rounded-2xl p-4 shadow-card flex gap-4">
        {/* Depth gauge */}
        <div className="flex flex-col items-center w-14 shrink-0">
          <span className="text-[10px] tracking-wider text-ink-300 mb-1.5">DEPTH</span>
          <div className="relative w-6 flex-1 min-h-[100px] rounded-full bg-surface-muted border border-surface-border overflow-hidden">
            <div
              className={`absolute bottom-0 left-0 right-0 rounded-full ${telemetry.wrongPath ? 'bg-status-fail' : 'bg-brand-500'}`}
              style={{ height: `${depthPct}%` }}
            />
          </div>
          <span className="font-mono text-sm font-semibold text-ink-900 mt-1.5">
            {(telemetry.depthCm ?? 0).toFixed(0)}
          </span>
          <span className="text-[10px] text-ink-300">cm</span>
        </div>

        {/* Right side stats */}
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-ink-500">Path</span>
            <PathBadge wrongPath={telemetry.wrongPath} correctPath={telemetry.correctPath} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-ink-500">Teeth contact</span>
            <span className={`text-sm font-semibold ${telemetry.teethSafe ? 'text-status-pass' : 'text-status-fail'}`}>
              {telemetry.teethSafe ? 'SAFE' : 'CONTACT'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-ink-500">Neck angle</span>
            <span className={`font-mono text-sm font-semibold ${telemetry.headCorrect ? 'text-status-pass' : 'text-ink-700'}`}>
              {telemetry.headAngle != null ? `${telemetry.headAngle.toFixed(1)}°` : '--'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-ink-500">Depth status</span>
            <span className="text-sm font-semibold text-ink-700">{telemetry.depthStatus ?? '--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
