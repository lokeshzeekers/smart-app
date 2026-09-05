import { useState } from 'react';
import api from '../api/client';

interface CreatedDevice {
  device: { device_uid: string; label: string };
  apiKey: string;
}

export default function RegisterDeviceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedDevice | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/admin/devices', { label });
      setCreated(data);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6">
        {!created ? (
          <>
            <h2 className="font-display font-semibold text-lg text-ink-900 mb-4">Register a manikin</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-ink-500 mb-1.5 block">Label</label>
                <input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Manikin 1 - Skills Lab"
                  className="w-full border border-surface-border rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              {error && <p className="text-status-fail text-sm">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 bg-surface-muted text-ink-700 rounded-xl py-3 font-medium text-[15px]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-brand-700 text-white rounded-xl py-3 font-medium text-[15px] hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {loading ? 'Creating…' : 'Register'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="font-display font-semibold text-lg text-ink-900 mb-2">Save these now</h2>
            <p className="text-sm text-status-fail mb-4">
              The API key is shown only this once. Flash both values into the manikin's firmware before closing this.
            </p>
            <div className="space-y-3 mb-6">
              <div>
                <p className="text-xs text-ink-300 mb-1">Device ID (x-device-id)</p>
                <p className="font-mono text-sm bg-surface-muted rounded-lg px-3 py-2 break-all">{created.device.device_uid}</p>
              </div>
              <div>
                <p className="text-xs text-ink-300 mb-1">API key (x-device-key)</p>
                <p className="font-mono text-sm bg-surface-muted rounded-lg px-3 py-2 break-all">{created.apiKey}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-full bg-brand-700 text-white rounded-xl py-3 font-medium text-[15px] hover:bg-brand-600 transition">
              I've saved this — close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
