import { useEffect, useState } from 'react';
import api from '../api/client';
import { getSocket } from '../api/socket';
import { StepItem } from '../components/StepList';

export interface SessionMetrics {
  laryngoscope_lift_force: number | null;
  time_to_place_ett: number | null;
  ett_location_cm: number | null;
  total_time_to_intubate: number | null;
  steps_passed: number | null;
  steps_total: number | null;
}

export interface Telemetry {
  toolDetected: boolean;
  teethSafe: boolean;
  depthCm: number | null;
  depthStatus: string | null;
  wrongPath: boolean;
  correctPath: boolean;
  headAngle: number | null;
  headCorrect: boolean;
  imuCalib: number;
  airflow: number | null;
  bannerMsg: string;
  bannerType: 'progress' | 'wrong' | 'complete';
}

export function useLiveSession(sessionId: string | undefined) {
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;

    api.get(`/trainee/sessions/${sessionId}/steps`).then(({ data }) => {
      if (!mounted) return;
      setSteps(data.steps);
      setMetrics(data.metrics);
      setLoading(false);
    });

    const socket = getSocket();
    socket?.emit('session:join', sessionId);

    const onStepUpdate = (evt: { step_no: number; completed: boolean; metric_value: number | null }) => {
      setSteps((prev) =>
        prev.map((s) => (s.step_no === evt.step_no ? { ...s, completed: evt.completed, metric_value: evt.metric_value } : s))
      );
    };

    const onComplete = (payload: { metrics: SessionMetrics }) => {
      setMetrics(payload.metrics);
      setCompleted(true);
    };

    const onTelemetry = (payload: Telemetry) => setTelemetry(payload);

    socket?.on('step:update', onStepUpdate);
    socket?.on('session:complete', onComplete);
    socket?.on('telemetry:update', onTelemetry);

    return () => {
      mounted = false;
      socket?.emit('session:leave', sessionId);
      socket?.off('step:update', onStepUpdate);
      socket?.off('session:complete', onComplete);
      socket?.off('telemetry:update', onTelemetry);
    };
  }, [sessionId]);

  return { steps, metrics, completed, loading, telemetry };
}
