import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Warning, LockKey } from '@phosphor-icons/react'
import { getToken, authFetch } from '../auth'

// Lecteur de flux HLS chiffré (Zero-Trust, Pôle 2).
// La clé AES n'est servie par le Core que sur jeton valide : hls.js joint le
// token UNIQUEMENT sur la requête `/keys/...`. Voir docs/FRONTEND-INTEGRATION.md.
const HLS_URL = import.meta.env.VITE_HLS_URL ?? 'http://localhost:8080'

// Messages destinés à des utilisateurs NON techniques (pros photo/vidéo) :
// clairs, rassurants, sans jargon. Le détail technique part en console.
const KEY_ERRORS = {
  401: 'Votre session a expiré. Reconnectez-vous pour reprendre la lecture.',
  403: "Vous n'avez pas accès à cette vidéo.",
  404: 'Vidéo introuvable.',
}

export default function SecureVideo({ contentId = 'poc' }) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | playing | error
  const [errorMsg, setErrorMsg] = useState(null)
  const [watermark, setWatermark] = useState(null)

  // Watermark de session (dissuasif, traçable).
  useEffect(() => {
    let alive = true
    authFetch('/security/watermark')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setWatermark(d.label))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const src = `${HLS_URL}/hls/${contentId}/index.m3u8`

    // Safari : HLS natif, mais impossible de joindre le token sur la clé.
    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        setStatus('playing')
        return undefined
      }
      setStatus('error')
      setErrorMsg('Lecteur HLS non supporté par ce navigateur.')
      return undefined
    }

    const hls = new Hls({
      xhrSetup: (xhr, url) => {
        // 🔑 token joint SEULEMENT sur la requête de clé
        if (url.includes('/keys/')) {
          xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`)
        }
      },
    })
    hls.loadSource(src)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus('playing'))
    hls.on(Hls.Events.ERROR, (_e, data) => {
      const code = data.response?.code
      if (code && KEY_ERRORS[code]) {
        setStatus('error')
        setErrorMsg(KEY_ERRORS[code])
        hls.destroy()
      } else if (data.fatal) {
        // détail technique pour les devs uniquement
        console.warn('[SecureVideo] erreur HLS fatale', data)
        setStatus('error')
        setErrorMsg('Lecture indisponible pour le moment. Réessayez dans un instant.')
        hls.destroy()
      }
    })
    return () => hls.destroy()
  }, [contentId])

  return (
    <div className="scroll-area">
      <div className="secure-wrap">
        <div className="secure-stage">
          <video ref={videoRef} className="secure-video" controls playsInline />

          {/* Watermark de session, incrusté (non bloquant) */}
          {watermark && (
            <>
              <span className="watermark watermark-center">{watermark}</span>
              <span className="watermark watermark-br">{watermark}</span>
            </>
          )}

          {status === 'loading' && (
            <div className="secure-overlay">
              <span className="spinner spinner-lg" />
              Chargement du flux sécurisé…
            </div>
          )}
          {status === 'error' && (
            <div className="secure-overlay error">
              <Warning size={30} weight="fill" />
              <p>{errorMsg}</p>
            </div>
          )}
        </div>

        <p className="secure-note">
          <LockKey size={14} weight="fill" />
          Lecture protégée — l'accès à cette vidéo est sécurisé et lié à votre compte.
        </p>
      </div>
    </div>
  )
}
