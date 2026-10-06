interface Props {
  state: 'complete' | 'assumed' | 'pending' | 'pass' | 'bad' | 'fail';
}

const colorMap: Record<Props['state'], string> = {
  complete: '#16A34A',
  assumed: '#BBF7D0', // credited without a sensor: light green with a green ring
  pending: '#CBD3D9',
  pass: '#16A34A',
  bad: '#D97706',
  fail: '#DC2626',
};

export default function StatusDot({ state }: Props) {
  return (
    <span
      className="status-dot"
      style={{ backgroundColor: colorMap[state], ...(state === 'assumed' ? { boxShadow: 'inset 0 0 0 2px #16A34A' } : {}) }}
    />
  );
}
