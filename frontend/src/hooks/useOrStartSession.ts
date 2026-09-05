import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/client';

/**
 * Coach/Check/Certification only work with a live sessionId. The Home page
 * cards create one and pass it via navigation state, but tapping the same
 * page's icon in the bottom nav is a plain link with no state - so the
 * page had nothing to show and sat on "Loading..." forever. This resolves
 * a sessionId either way: use the one passed in state, or start a fresh
 * one for this mode automatically.
 */
export function useOrStartSession(mode: 'coach' | 'check' | 'certification') {
  const { state } = useLocation() as { state?: { sessionId?: string } };
  const [autoSessionId, setAutoSessionId] = useState<string | undefined>();
  const [starting, setStarting] = useState(!state?.sessionId);

  useEffect(() => {
    if (state?.sessionId) return;
    let cancelled = false;
    setStarting(true);
    api.post('/trainee/sessions', { mode }).then(({ data }) => {
      if (!cancelled) {
        setAutoSessionId(data.session.id);
        setStarting(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.sessionId, mode]);

  return { sessionId: state?.sessionId || autoSessionId, starting };
}
