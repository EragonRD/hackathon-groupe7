// useMetadata — récupère les métadonnées IA (contrat P3-A) d'un contenu via le
// Core (/contents/:id/metadata) et re-poll tant que l'analyse est « processing ».
// Renvoie { status: 'loading'|'processing'|'done'|'error'|'not_analyzed', data?, error? }.

import { useEffect, useRef, useState } from 'react'
import { getMetadata } from '../contents'

const POLL_MS = 4000

export function useMetadata(contentId) {
  const [state, setState] = useState(() => ({
    id: contentId,
    status: contentId ? 'loading' : 'not_analyzed',
  }))
  const timerRef = useRef(null)

  // Reset SYNCHRONE au changement de contenu (pattern React « ajuster l'état
  // pendant le rendu ») : on remet 'loading' sans setState dans l'effet, ce qui
  // évite un flash de données périmées ET la cascade de rendus.
  if (state.id !== contentId) {
    setState({ id: contentId, status: contentId ? 'loading' : 'not_analyzed' })
  }

  useEffect(() => {
    if (!contentId) return
    let cancelled = false

    const poll = async () => {
      try {
        const r = await getMetadata(contentId)
        if (cancelled) return
        setState({ id: contentId, ...r })
        // Analyse en cours -> on re-interroge jusqu'à résolution.
        if (r.status === 'processing') {
          timerRef.current = setTimeout(poll, POLL_MS)
        }
      } catch (e) {
        if (!cancelled) setState({ id: contentId, status: 'error', error: e.message })
      }
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [contentId])

  return state
}
