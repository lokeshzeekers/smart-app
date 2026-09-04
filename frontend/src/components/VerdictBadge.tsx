type Verdict = 'pass' | 'bad_technique' | 'fail';

const config: Record<Verdict, { label: string; text: string; bg: string }> = {
  pass: { label: 'PASS', text: 'text-status-pass', bg: 'bg-status-passBg' },
  bad_technique: { label: 'Bad Technique', text: 'text-status-bad', bg: 'bg-status-badBg' },
  fail: { label: 'FAIL', text: 'text-status-fail', bg: 'bg-status-failBg' },
};

export default function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const c = config[verdict];
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.text} ${c.bg}`}>
      {c.label}
    </span>
  );
}
