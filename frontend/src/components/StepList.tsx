import StatusDot from './StatusDot';

export interface StepItem {
  step_no: number;
  title: string;
  has_metric: boolean;
  metric_unit: string | null;
  completed: boolean | null;
  metric_value: number | null;
}

export default function StepList({ steps, numbered = true }: { steps: StepItem[]; numbered?: boolean }) {
  return (
    <ul className="divide-y divide-surface-border">
      {steps.map((s) => (
        <li key={s.step_no} className="flex items-center justify-between py-3.5">
          <span className="text-[15px] text-ink-700 pr-3">
            {numbered ? `${s.step_no}. ${s.title}` : `Step - ${s.step_no}`}
          </span>
          <div className="flex items-center gap-2.5 shrink-0">
            {s.has_metric && s.metric_value != null && (
              <span className="text-sm font-medium text-brand-700">
                {s.metric_value}
                {s.metric_unit}
              </span>
            )}
            <StatusDot state={s.completed ? 'complete' : 'pending'} />
          </div>
        </li>
      ))}
    </ul>
  );
}
