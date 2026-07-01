import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Warning, LockKey, FilmSlate, Tag, UserList } from '@phosphor-icons/react'
import { getToken, authFetch } from '../auth'

const HLS_URL = import.meta.env.VITE_HLS_URL ?? 'http://localhost:8080'

const KEY_ERRORS = {
  401: 'Votre session a expiré. Reconnectez-vous pour reprendre la lecture.',
  403: "Vous n'avez pas accès à cette vidéo.",
  404: 'Vidéo introuvable.',
}

export default function SecureVideo({ contentId, src, title, category, invited }) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState(src ? 'playing' : 'loading')
  const [errorMsg, setErrorMsg] = useState(null)
  const [watermark, setWatermark] = useState(null)

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
    if (!src) return
    const video = videoRef.current
    if (!video) return
    video.src = src
    video.addEventListener('loadedmetadata', () => setStatus('playing'), { once: true })
    video.addEventListener(
      'error',
      () => {
        setStatus('error')
        setErrorMsg('Fichier vidéo illisible.')
      },
      { once: true },
    )
  }, [src])

  useEffect(() => {
    if (src || !contentId) return
    const video = videoRef.current
    const hlsSrc = `${HLS_URL}/hls/${contentId}/index.m3u8`

    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsSrc
        setStatus('playing')
        return undefined
      }
      setStatus('error')
      setErrorMsg('Lecteur HLS non supporté par ce navigateur.')
      return undefined
    }

    const hls = new Hls({
      xhrSetup: (xhr, url) => {
        if (url.includes('/keys/')) {
          xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`)
        }
      },
    })
    hls.loadSource(hlsSrc)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus('playing'))
    hls.on(Hls.Events.ERROR, (_e, data) => {
      const code = data.response?.code
      if (code && KEY_ERRORS[code]) {
        setStatus('error')
        setErrorMsg(KEY_ERRORS[code])
        hls.destroy()
      } else if (data.fatal) {
        console.warn('[SecureVideo] erreur HLS fatale', data)
        setStatus('error')
        setErrorMsg('Lecture indisponible pour le moment. Réessayez dans un instant.')
        hls.destroy()
      }
    })
    return () => hls.destroy()
  }, [contentId, src])

  return (
    <div className="scroll-area">
      <div className="secure-wrap">
        {title && (
          <div className="secure-head">
            <FilmSlate size={18} weight="fill" color="var(--accent-strong)" />
            <div>
              <h2>{title}</h2>
            </div>
          </div>
        )}

        <div className="secure-stage">
          <video ref={videoRef} className="secure-video" controls playsInline />

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

        <div className="secure-meta-bar">
          {category && (
            <span className="secure-chip">
              <Tag size={12} weight="bold" />
              {category}
            </span>
          )}
          {invited && invited.length > 0 && (
            <span className="secure-chip">
              <UserList size={12} weight="bold" />
              {invited.join(', ')}
            </span>
          )}
          <span className="secure-chip secure-chip-muted">
            <LockKey size={12} weight="bold" />
            {src ? 'Fichier local' : 'Flux sécurisé'}
          </span>
        </div>
      </div>
    </div>
  )
}
