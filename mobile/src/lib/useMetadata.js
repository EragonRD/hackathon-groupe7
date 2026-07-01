import { useEffect, useRef, useState } from 'react';
import { getMetadata } from './contents';

const POLL_MS = 4000;

// Récupère les métadonnées IA d'un contenu et re-poll tant que l'analyse tourne.
// Renvoie { status: 'loading'|'processing'|'done'|'error'|'not_analyzed', data?, error? }.
export function useMetadata(contentId) {
  const [state, setState] = useState({ status: 'loading' });
  const timerRef = useRef(null);

  useEffect(() => {
    if (!contentId) {
      setState({ status: 'not_analyzed' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });

    const poll = async () => {
      try {
        const r = await getMetadata(contentId);
        if (cancelled) return;
        setState(r);
        if (r.status === 'processing') {
          timerRef.current = setTimeout(poll, POLL_MS);
        }
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e.message });
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [contentId]);

  return state;
}
