interface Props {
  state: 'complete' | 'pending' | 'pass' | 'bad' | 'fail';
}

const colorMap: Record<Props['state'], string> = {
  complete: '#16A34A',
  pending: '#CBD3D9',
  pass: '#16A34A',
  bad: '#D97706',
  fail: '#DC2626',
};

export default function StatusDot({ state }: Props) {
  return <span className="status-dot" style={{ backgroundColor: colorMap[state] }} />;
}
