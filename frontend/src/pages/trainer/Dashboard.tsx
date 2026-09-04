import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import VerdictBadge from '../../components/VerdictBadge';
import TrainerBottomNav from '../../components/TrainerBottomNav';

const INSTITUTIONS = ['IIT-M', 'Apollo', 'AIIMS', 'JIPMER'];

interface QueueRow {
  evaluation_id: string;
  trainee_id: string;
  full_name: string;
  avatar_url: string | null;
  smart_score: number;
  ai_suggestion: 'pass' | 'bad_technique' | 'fail';
  ai_notes: string | null;
  steps_passed: number;
  steps_total: number;
}

export default function TrainerDashboard() {
  const [activeTab, setActiveTab] = useState(INSTITUTIONS[0]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get('/trainer/review-queue', { params: { institutionCode: activeTab } }).then(({ data }) => {
      setQueue(data.queue);
      setLoading(false);
    });
  }, [activeTab]);

  useEffect(() => {
    const socket = getSocket();
    const onNew = () => setNotifCount((c) => c + 1);
    socket?.on('review:new', onNew);
    return () => {
      socket?.off('review:new', onNew);
    };
  }, []);

  return (
    <div className="min-h-screen max-w-md mx-auto pb-24">
      <header className="pt-6 pb-4 px-5">
        <h1 className="font-display font-semibold text-lg text-ink-900 mb-4">SMArT Score for Review</h1>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {INSTITUTIONS.map((code) => (
            <button
              key={code}
              onClick={() => setActiveTab(code)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                activeTab === code ? 'bg-brand-700 text-white' : 'bg-surface-muted text-ink-500'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </header>

      <div className="px-5 space-y-3">
        {loading && <p className="text-ink-300 text-sm text-center py-8">Loading review queue…</p>}

        {!loading && queue.length === 0 && (
          <p className="text-ink-300 text-sm text-center py-8">No submissions pending review for {activeTab}.</p>
        )}

        {queue.map((row) => (
          <div key={row.evaluation_id} className="bg-surface-card rounded-2xl p-4 shadow-card flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium overflow-hidden">
                {row.avatar_url ? <img src={row.avatar_url} className="w-full h-full object-cover" /> : row.full_name[0]}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                style={{
                  backgroundColor:
                    row.ai_suggestion === 'pass' ? '#16A34A' : row.ai_suggestion === 'fail' ? '#DC2626' : '#D97706',
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-ink-900 truncate">
                {row.full_name} <span className="text-ink-500 font-normal">{row.smart_score}</span>{' '}
                <span className="text-ink-300 text-xs font-normal">
                  {row.steps_passed}/{row.steps_total}
                </span>
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-ink-500">AI Suggestion:</span>
                <VerdictBadge verdict={row.ai_suggestion} />
              </div>
              {row.ai_notes && <p className="text-xs text-ink-300 mt-1 truncate">{row.ai_notes}</p>}
            </div>

            <button
              onClick={() => navigate(`/trainer/review/${row.evaluation_id}`)}
              className="shrink-0 bg-brand-900 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-brand-700 transition"
            >
              Review
            </button>
          </div>
        ))}
      </div>

      <TrainerBottomNav notifCount={notifCount} />
    </div>
  );
}
