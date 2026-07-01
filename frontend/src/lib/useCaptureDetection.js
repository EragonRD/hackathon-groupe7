// useCaptureDetection — "Capture Guard" maison, 100 % web / React.
//
// IMPORTANT (honnêteté technique) : le navigateur n'expose AUCUN moyen fiable de
// PROUVER qu'un enregistrement d'écran tiers est en cours (OBS, outil OS, téléphone).
// Ce hook agrège donc des SIGNAUX de risque réels et observables, en calcule un
// SCORE, occulte la vidéo sur le seul signal fiable ("page inactive"), et remonte
// le risque au Core (/security/capture-report) pour traçabilité dans le dashboard
// de surveillance. C'est de la DISSUASION + TRAÇABILITÉ, pas une garantie.

import { useEffect, useRef, useState } from 'react'
import { authFetch } from '../auth'

// Poids de chaque signal dans le score (0..100).
const WEIGHTS = {
  page_inactive: 40, // onglet caché ou fenêtre sans focus -> on occulte
  extended_display: 20, // multi-moniteur (rig de capture fréquent)
  devtools: 25, // outils dev ouverts (rippers)
  fullscreen_exit: 15, // sortie du plein écran pendant la lecture
}
const REPORT_MIN_RISK = 40 // en dessous : bruit, on ne remonte rien
const REPORT_THROTTLE_MS = 15000 // 1 remontée / 15 s max
const POLL_MS = 3000 // ré-évaluation périodique (multi-écran, devtools)

// Heuristique "devtools ouvert" : large écart entre la fenêtre externe et la zone
// de rendu. Bruitée (barres, zoom) -> poids modéré, jamais bloquante seule.
function devtoolsLikelyOpen() {
  const threshold = 160
  const w = window.outerWidth - window.innerWidth > threshold
  const h = window.outerHeight - window.innerHeight > threshold
  return w || h
}

export function useCaptureDetection({ session, contentId, playing } = {}) {
  const [guarded, setGuarded] = useState(false)
  const [risk, setRisk] = useState(0)
  const lastReportRef = useRef(0)

  useEffect(() => {
    let stopped = false

    const evaluate = () => {
      if (stopped) return
      const active = []

      const inactive =
        document.visibilityState === 'hidden' ||
        (typeof document.hasFocus === 'function' && !document.hasFocus())
      if (inactive) active.push('page_inactive')

      // screen.isExtended : true si un écran secondaire est branché (Chromium).
      if (typeof window.screen?.isExtended === 'boolean' && window.screen.isExtended)
        active.push('extended_display')

      if (devtoolsLikelyOpen()) active.push('devtools')

      // Plein écran attendu mais absent pendant la lecture.
      if (playing && document.fullscreenElement === null && sessionExpectsFs())
        active.push('fullscreen_exit')

      const score = Math.min(
        100,
        active.reduce((sum, s) => sum + (WEIGHTS[s] ?? 0), 0),
      )

      setGuarded(inactive)
      setRisk(score)
      maybeReport(score, active)
    }

    // On ne force pas le plein écran ici ; ce sous-signal reste neutre tant qu'on
    // ne l'active pas explicitement (évite les faux positifs en lecture fenêtrée).
    const sessionExpectsFs = () => false

    const maybeReport = (score, signals) => {
      if (score < REPORT_MIN_RISK) return
      const now = Date.now()
      if (now - lastReportRef.current < REPORT_THROTTLE_MS) return
      lastReportRef.current = now
      // Fire-and-forget : la télémétrie ne doit jamais bloquer la lecture.
      void authFetch('/security/capture-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, contentId, risk: score, signals }),
      }).catch(() => {})
    }

    evaluate()
    const onEvt = () => evaluate()
    document.addEventListener('visibilitychange', onEvt)
    window.addEventListener('blur', onEvt)
    window.addEventListener('focus', onEvt)
    document.addEventListener('fullscreenchange', onEvt)
    const id = setInterval(evaluate, POLL_MS)

    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onEvt)
      window.removeEventListener('blur', onEvt)
      window.removeEventListener('focus', onEvt)
      document.removeEventListener('fullscreenchange', onEvt)
      clearInterval(id)
    }
  }, [session, contentId, playing])

  return { guarded, risk }
}
