import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Play,
  Pause,
  Cursor,
  PencilSimple,
  Eraser,
  ArrowUpRight,
  Rectangle,
  Circle,
  TextT,
  DownloadSimple,
  UploadSimple,
  Broadcast,
  Eye,
  TrashSimple,
  ArrowsOutSimple,
  ArrowsInSimple,
  ClosedCaptioning,
  Gauge,
  SpeakerHigh,
  SpeakerLow,
  SpeakerSlash,
} from '@phosphor-icons/react'
import Hls from 'hls.js'
import { getToken } from '../auth'
import DrawingCanvas from './DrawingCanvas'
import CommentPanel from './CommentPanel'
import InsightsPanel from './InsightsPanel'
import { useMetadata } from '../lib/useMetadata'
import { useReview } from '../lib/useReview'
import { useCaptureDetection } from '../lib/useCaptureDetection'
import { formatTime } from '../lib/format'

// ============================================================================
//  VideoReview — composant de revue autonome et réutilisable.
//  Props :
//    source  : URL de la vidéo (string)
//    session : identifiant de session de revue (string) — sert de "room"
//    user    : { id?, username, role } (utilisé comme auteur + couleur)
//  Tout l'état (notes, présence, curseurs, lecture partagée) vit dans useReview
//  et se synchronise via la couche collab. Aucune dépendance au reste de l'app.
//
//  Watch Together : un participant « prend la présentation » -> ses play/pause/
//  seek se répercutent chez les invités, qui suivent (contrôles verrouillés) et
//  se recalent en cas de dérive. Anti-écho via un drapeau `applyingRemote`.
// ============================================================================

const TOOLS = [
  { id: 'cursor', label: 'Curseur', Icon: Cursor },
  { id: 'pen', label: 'Trait libre', Icon: PencilSimple },
  { id: 'eraser', label: 'Gomme libre', Icon: Eraser },
  { id: 'arrow', label: 'Flèche', Icon: ArrowUpRight },
  { id: 'rect', label: 'Cadre', Icon: Rectangle },
  { id: 'ellipse', label: 'Ellipse', Icon: Circle },
  { id: 'text', label: 'Texte', Icon: TextT },
]

const SWATCHES = [
  { name: 'Ambre', value: '#f5a623' },
  { name: 'Rouge', value: '#ff5b5b' },
  { name: 'Vert', value: '#2ec27e' },
  { name: 'Cyan', value: '#29c5e6' },
  { name: 'Violet', value: '#b07bff' },
  { name: 'Blanc', value: '#f4f6fa' },
]

// Seuil de recalage (s) : en dessous on ne touche à rien. Tolérant car sur un
// flux HLS chiffré un seek coûte cher (fetch + déchiffrement du segment) ; un
// seuil trop serré provoquerait des re-seeks en boucle (bégaiement).
const DRIFT_THRESHOLD = 1.5
const HEARTBEAT_MS = 2000

export default function VideoReview({ source, session, user, contentId, onPeersUpdate }) {
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const stageRef = useRef(null)

  const {
    self,
    notes,
    peers,
    addNote,
    updateNote,
    replyToNote,
    resolveNote,
    removeNote,
    updateNoteShapes,
    replaceNotes,
    sendCursor,
    toggleLike,
    addReply,
    deleteReply,
    presenterId,
    isPresenter,
    claimPresenter,
    releasePresenter,
    sendSelect,
    sendPlayback,
    sendHeartbeat,
    sendRate,
    subscribePlayback,
  } = useReview({ session, user })

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  // Protection capture ("Capture Guard") : agrège des signaux de risque, occulte
  // le flux quand la page n'est plus active, et remonte le risque au Core pour le
  // dashboard de surveillance (voir lib/useCaptureDetection). Filet complémentaire :
  // watermark dynamique (identité + horloge) incrusté en permanence.
  const { guarded, risk: captureRisk } = useCaptureDetection({
    session,
    contentId: source,
    playing,
  })
  const [wmClock, setWmClock] = useState('')
  useEffect(() => {
    const tick = () =>
      setWmClock(
        new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }),
      )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  // Quand la page est masquée, on met AUSSI la lecture en pause (coupe le son et
  // gèle l'image sous l'overlay).
  useEffect(() => {
    if (guarded) videoRef.current?.pause()
  }, [guarded])
  const watermark = `${user?.username ?? 'invité'} · ${session ?? ''} · ${wmClock}`

  const [tool, setTool] = useState('cursor')
  const [color, setColor] = useState('#f5a623')

  const [draftShapes, setDraftShapes] = useState([])
  const [pinnedTime, setPinnedTime] = useState(null)
  const [text, setText] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [pendingText, setPendingText] = useState(null) // { x, y } position du texte en attente

  // Suit-on un présentateur ? (présentateur défini, et ce n'est pas moi)
  const following = Boolean(presenterId) && !isPresenter

  const composeTime = pinnedTime ?? currentTime
  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId],
  )

  // Le calque affiche le brouillon en cours, sinon les dessins de la note active.
  const shapesToShow = draftShapes.length > 0 ? draftShapes : (activeNote?.shapes ?? [])

  // --- Sous-titres (transcription P3) incrustés sur la vidéo ----------------
  // Partagés avec InsightsPanel (meta passé en prop pour ne pas double-poller).
  const meta = useMetadata(contentId)
  const captionSegments = useMemo(
    () => (meta.status === 'done' ? (meta.data?.segments ?? []) : []),
    [meta],
  )
  const [captionsOn, setCaptionsOn] = useState(true)
  const activeCaption = useMemo(() => {
    if (!captionsOn || captionSegments.length === 0) return ''
    const seg = captionSegments.find(
      (s) => currentTime >= (s.start ?? 0) && currentTime < (s.end ?? Infinity),
    )
    return seg?.text ?? ''
  }, [captionsOn, captionSegments, currentTime])

  // --- Contrôles compacts : vitesse (menu déroulant) + volume (barre + %) -----
  const [speedOpen, setSpeedOpen] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [volOpen, setVolOpen] = useState(false)
  // Applique volume/mute à l'élément <video> (persiste au changement de source HLS).
  useEffect(() => {
    const v = videoRef.current
    if (v) {
      v.volume = volume
      v.muted = muted
    }
  }, [volume, muted, ready])

  // --- Réfs "fraîches" pour les handlers d'événements vidéo --------------
  const isPresenterRef = useRef(isPresenter)
  const followingRef = useRef(following)
  const applyingRemoteRef = useRef(false) // true pendant qu'on applique une commande distante
  const applyTimerRef = useRef(null)
  const driftRef = useRef(null) // { position, paused, receivedAt } du présentateur
  useEffect(() => {
    isPresenterRef.current = isPresenter
  }, [isPresenter])
  useEffect(() => {
    followingRef.current = following
  }, [following])

  // Pose le drapeau anti-écho puis le relâche (les events play/pause/seeked sont
  // asynchrones) — on évite ainsi de réémettre une commande qu'on vient d'appliquer.
  const beginApplyingRemote = useCallback(() => {
    applyingRemoteRef.current = true
    clearTimeout(applyTimerRef.current)
    applyTimerRef.current = setTimeout(() => {
      applyingRemoteRef.current = false
    }, 250)
  }, [])

  // --- Contrôle de la lecture --------------------------------------------
  const pause = useCallback(() => {
    videoRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
    if (followingRef.current) return // invité : contrôles verrouillés
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }, [])

  const seekTo = useCallback((t) => {
    if (followingRef.current) return // invité : navigation pilotée par le présentateur
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(t, v.duration || t))
  }, [])

  // --- Annotation ---------------------------------------------------------
  // Première forme dessinée : on épingle l'instant et on met en pause.
  function handleAddShape(shape) {
    setDraftShapes((prev) => [...prev, shape])
    if (pinnedTime == null) {
      setPinnedTime(videoRef.current?.currentTime ?? currentTime)
      if (!followingRef.current) pause()
    }
    setActiveId(null)
  }

  function handleBeginAnnotation() {
    if (pinnedTime == null) {
      setPinnedTime(videoRef.current?.currentTime ?? currentTime)
      pause()
    }
    setActiveId(null)
  }

  const ERASE_THRESHOLD = 0.04
  function shapeHitByPath(shape, points) {
    if (shape.tool === 'pen') {
      const pts = shape.points || []
      return pts.some((sp) =>
        points.some((ep) => Math.hypot(sp.x - ep.x, sp.y - ep.y) < ERASE_THRESHOLD),
      )
    }
    if (shape.tool === 'rect' || shape.tool === 'arrow') {
      const minX = Math.min(shape.from.x, shape.to.x) - ERASE_THRESHOLD
      const maxX = Math.max(shape.from.x, shape.to.x) + ERASE_THRESHOLD
      const minY = Math.min(shape.from.y, shape.to.y) - ERASE_THRESHOLD
      const maxY = Math.max(shape.from.y, shape.to.y) + ERASE_THRESHOLD
      return points.some(
        (ep) => ep.x >= minX && ep.x <= maxX && ep.y >= minY && ep.y <= maxY,
      )
    }
    return false
  }

  function handleErase(points) {
    if (activeId) {
      const note = notes.find((n) => n.id === activeId)
      if (note) {
        const remaining = (note.shapes || []).filter((s) => !shapeHitByPath(s, points))
        if (remaining.length !== (note.shapes || []).length) {
          updateNoteShapes(note.id, remaining)
        }
      }
    } else {
      setDraftShapes((prev) => prev.filter((s) => !shapeHitByPath(s, points)))
    }
    setTool('eraser') // keep eraser active for consecutive strokes
  }

  function handleTextPlace(pos) {
    setPendingText(pos)
    setActiveId(null)
  }

  function handleTextSubmit(textVal) {
    if (!textVal.trim()) {
      setPendingText(null)
      return
    }
    const shape = {
      tool: 'text',
      color,
      x: pendingText.x,
      y: pendingText.y,
      text: textVal,
      fontSize: 18,
    }
    setDraftShapes((prev) => [...prev, shape])
    if (pinnedTime == null) {
      setPinnedTime(videoRef.current?.currentTime ?? currentTime)
      if (!followingRef.current) pause()
    }
    setPendingText(null)
  }

  function handleTextChange(value) {
    setText(value)
    if (value && pinnedTime == null) {
      setPinnedTime(videoRef.current?.currentTime ?? currentTime)
    }
  }

  function clearDraft() {
    setDraftShapes([])
    if (!text.trim()) setPinnedTime(null)
  }

  function submitNote() {
    if (!text.trim() && draftShapes.length === 0) return
    if (editingId) {
      updateNote(editingId, {
        time: composeTime,
        text: text.trim(),
        shapes: draftShapes,
        color,
      })
    } else {
      addNote({ time: composeTime, text, shapes: draftShapes, color })
    }
    setDraftShapes([])
    setText('')
    setPinnedTime(null)
    setTool('cursor')
    setEditingId(null)
  }

  function selectNote(note) {
    setActiveId(note.id)
    setDraftShapes([])
    setPinnedTime(null)
    setText('')
    setEditingId(null)
    // Invité en suivi (souvent un client) : sélection LOCALE pour consulter la
    // remarque et ses dessins, SANS toucher à la lecture (pilotée par le
    // présentateur) ni rediffuser. Le présentateur peut réaligner via wt:select.
    if (following) return
    seekTo(note.time)
    pause()
    // Présentateur : les invités affichent la même note active (mêmes dessins).
    if (isPresenter) sendSelect(note.id)
  }

  function editNote(note) {
    setActiveId(note.id)
    setEditingId(note.id)
    setDraftShapes(note.shapes ?? [])
    setPinnedTime(note.time)
    setText(note.text ?? '')
    setColor(note.color ?? note.author.color ?? color)
    seekTo(note.time)
    pause()
  }

  function seekToAdjacentNote(direction) {
    if (notes.length === 0) return
    const sorted = [...notes].sort((a, b) => a.time - b.time)
    const target =
      direction < 0
        ? [...sorted].reverse().find((n) => n.time < currentTime - 0.05)
        : sorted.find((n) => n.time > currentTime + 0.05)
    if (target) selectNote(target)
  }

  const canDelete = useCallback(
    (note) => note.author.id === self.id || self.role === 'admin',
    [self],
  )

  // --- Export / Import JSON ----------------------------------------------
  function exportJSON() {
    const payload = {
      version: 1,
      session,
      exportedAt: new Date().toISOString(),
      notes,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `revue-${session}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJSON(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const incoming = Array.isArray(data) ? data : data.notes
        if (!Array.isArray(incoming)) throw new Error('format invalide')
        replaceNotes(incoming)
        setActiveId(null)
      } catch (err) {
        alert('Import impossible : ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  // --- Événements vidéo : état local + émission présentateur --------------
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    setReady(false)
    setVideoError(false)
    const onTime = () => setCurrentTime(v.currentTime)
    const onMeta = () => {
      setDuration(v.duration || 0)
      setReady(true)
    }
    const onPlay = () => {
      setPlaying(true)
      if (isPresenterRef.current && !applyingRemoteRef.current) {
        sendPlayback({ action: 'play', position: v.currentTime })
      }
    }
    const onPause = () => {
      setPlaying(false)
      if (isPresenterRef.current && !applyingRemoteRef.current) {
        sendPlayback({ action: 'pause', position: v.currentTime })
      }
    }
    const onSeeked = () => {
      if (isPresenterRef.current && !applyingRemoteRef.current) {
        sendPlayback({ action: 'seek', position: v.currentTime })
      }
    }
    const onError = () => {
      setReady(false)
      setVideoError(true)
      setPlaying(false)
    }
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('seeked', onSeeked)
    v.addEventListener('error', onError)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('seeked', onSeeked)
      v.removeEventListener('error', onError)
    }
  }, [source, sendPlayback])

  // --- Présentateur : battement régulier (anti-dérive) -------------------
  useEffect(() => {
    if (!isPresenter) return
    const id = setInterval(() => {
      const v = videoRef.current
      if (v)
        sendHeartbeat({
          position: v.currentTime,
          paused: v.paused,
          rate: v.playbackRate,
        })
    }, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [isPresenter, sendHeartbeat])

  // --- Remonte les pairs vers AppShell pour les pastilles de présence -----
  useEffect(() => {
    onPeersUpdate?.(peers)
  }, [peers, onPeersUpdate])

  // --- Invité : applique les commandes distantes -------------------------
  useEffect(() => {
    const off = subscribePlayback((evt) => {
      if (isPresenterRef.current) return // le présentateur ne s'applique pas à lui-même
      // Sélection de commentaire pilotée par le présentateur (mêmes dessins affichés).
      if (evt.kind === 'select') {
        setActiveId(evt.noteId ?? null)
        return
      }
      const v = videoRef.current
      if (!v) return

      // Vitesse de lecture imposée par le présentateur (portée aussi par les
      // heartbeats / la resync retardataire).
      if (typeof evt.rate === 'number' && v.playbackRate !== evt.rate) {
        v.playbackRate = evt.rate
        setPlaybackRate(evt.rate)
      }
      if (evt.kind === 'rate') return // rien d'autre à appliquer

      if (evt.kind === 'playback') {
        beginApplyingRemote()
        if (evt.action === 'seek' && typeof evt.position === 'number') {
          v.currentTime = evt.position
        } else if (evt.action === 'play') {
          if (
            typeof evt.position === 'number' &&
            Math.abs(v.currentTime - evt.position) > 0.3
          ) {
            v.currentTime = evt.position
          }
          v.play().catch(() => {})
        } else if (evt.action === 'pause') {
          if (typeof evt.position === 'number') v.currentTime = evt.position
          v.pause()
        }
        driftRef.current = {
          position: evt.position,
          paused: evt.action !== 'play',
          receivedAt: Date.now(),
        }
      } else if (evt.kind === 'state' || evt.kind === 'heartbeat') {
        // Resync (retardataire) ou battement : on mémorise pour le recalage.
        if (typeof evt.position === 'number') {
          // Compense le temps écoulé depuis l'émission si la lecture tourne.
          const elapsed = evt.paused
            ? 0
            : Math.max(0, (Date.now() - (evt.at ?? Date.now())) / 1000)
          driftRef.current = {
            position: evt.position + elapsed,
            paused: !!evt.paused,
            receivedAt: Date.now(),
          }
        }
      }
    })
    return off
  }, [subscribePlayback, beginApplyingRemote])

  // --- Invité : boucle de recalage (dérive + état lecture) ---------------
  useEffect(() => {
    if (!following) return
    const id = setInterval(() => {
      const v = videoRef.current
      const d = driftRef.current
      if (!v || !d) return
      // Aligne l'état lecture/pause sur le présentateur.
      if (d.paused && !v.paused) {
        beginApplyingRemote()
        v.pause()
      } else if (!d.paused && v.paused) {
        beginApplyingRemote()
        v.play().catch(() => {})
      }
      // Recalage de position seulement en lecture, ET si la vidéo n'est pas déjà
      // en train de chercher/bufferiser (readyState >= HAVE_FUTURE_DATA). Sinon,
      // sur du HLS chiffré, on empilerait les seeks pendant le buffering -> le
      // player n'arrive jamais à reprendre. On laisse le buffering se terminer.
      if (!d.paused && !v.seeking && v.readyState >= 3) {
        const expected = d.position + (Date.now() - d.receivedAt) / 1000
        if (Math.abs(v.currentTime - expected) > DRIFT_THRESHOLD) {
          beginApplyingRemote()
          v.currentTime = expected
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [following, beginApplyingRemote])

  // Barre d'espace = play/pause (sauf en saisie de texte ou si on suit un présentateur).
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay])

  // --- Scrubber ----------------------------------------------------------
  const scrubRef = useRef(null)
  function scrubToEvent(e) {
    if (following) return // invité : navigation verrouillée
    const r = scrubRef.current.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    seekTo(frac * (duration || 0))
  }

  function handleScrubberKey(e) {
    if (e.key === 'ArrowLeft' && e.shiftKey) {
      e.preventDefault()
      seekToAdjacentNote(-1)
    } else if (e.key === 'ArrowRight' && e.shiftKey) {
      e.preventDefault()
      seekToAdjacentNote(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      seekTo(currentTime - 5)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      seekTo(currentTime + 5)
    } else if (e.key === 'Home') {
      e.preventDefault()
      seekTo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      seekTo(duration || currentTime)
    }
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  // --- Plein écran --------------------------------------------------------
  const [fullscreen, setFullscreen] = useState(false)
  function toggleFullscreen() {
    const el = stageRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.()
        .then(() => setFullscreen(true))
        .catch(() => {})
    } else {
      document
        .exitFullscreen?.()
        .then(() => setFullscreen(false))
        .catch(() => {})
    }
  }
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // 🔐 Lecture du flux HLS CHIFFRÉ (Zero-Trust) : hls.js alimente l'élément vidéo
  // et joint le JWT UNIQUEMENT sur la requête de clé (/keys/…). Un fichier direct
  // (.mp4) reste géré par l'attribut src. Récupération d'erreur robuste (le HLS
  // en `-c copy` peut générer des erreurs média non fatales à récupérer).
  useEffect(() => {
    const v = videoRef.current
    if (!v || !source || !source.endsWith('.m3u8')) return
    if (!Hls.isSupported()) {
      // Safari : HLS natif (la clé ne peut pas porter le token → utiliser Chrome).
      if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = source
      return
    }
    const hls = new Hls({
      // Garde ~5 min de segments déjà lus en mémoire : un seek ARRIÈRE retombe
      // sur du buffer au lieu de re-télécharger + re-déchiffrer le segment (ce
      // qui rendait le retour en arrière lent/impossible sur le flux chiffré).
      backBufferLength: 300,
      xhrSetup: (xhr, url) => {
        if (url.includes('/keys/')) {
          const token = getToken()
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        }
      },
    })
    let lastRecover = 0
    let netRetry = 0
    // Sur un chargement/segment réussi : on efface l'erreur ET on remet à zéro le
    // compteur de retries réseau (les erreurs transitoires passées sont oubliées).
    const clear = () => {
      setVideoError(false)
      netRetry = 0
    }
    hls.on(Hls.Events.MANIFEST_PARSED, clear)
    hls.on(Hls.Events.FRAG_BUFFERED, clear)
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        // stall / append error (fréquent au seek sur HLS ré-encodé) : on récupère
        // SANS JAMAIS détruire le player. Garde-fou anti-boucle serrée : on ne
        // relance une récupération que si la précédente date de > 2 s.
        const now = Date.now()
        if (now - lastRecover > 2000) {
          lastRecover = now
          hls.recoverMediaError()
        }
      } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        const code = data.response?.code
        // 404 = flux non provisionné (contenu sans HLS) ; 401/403 = accès refusé
        // ou lien invité expiré : erreurs PERMANENTES -> on affiche l'erreur au
        // lieu de retenter à l'infini (ce qui laissait « Chargement… » sans fin).
        if (code === 404 || code === 401 || code === 403) {
          setVideoError(true)
        } else if (netRetry < 3) {
          // Réseau transitoire : quelques retries.
          netRetry += 1
          hls.startLoad()
        } else {
          setVideoError(true)
        }
      } else {
        // Erreur vraiment irrécupérable (ex. manifest) : on signale, on arrête.
        setVideoError(true)
        hls.destroy()
      }
    })
    hls.loadSource(source)
    hls.attachMedia(v)
    return () => hls.destroy()
  }, [source])

  // --- Vitesse de lecture -------------------------------------------------
  function setRate(rate) {
    if (!videoRef.current) return
    videoRef.current.playbackRate = rate
    setPlaybackRate(rate)
    // Présentateur : propager la vitesse aux invités (watch-together).
    if (isPresenterRef.current) sendRate(rate)
  }

  // Nom du présentateur courant (pour le badge).
  const presenterName = isPresenter
    ? self.name
    : (peers.find((p) => p.id === presenterId)?.name ?? 'le présentateur')

  return (
    <div className="review">
      <div className="review-main">
        <div className="stage" ref={stageRef}>
          <div className="stage-inner">
            <video
              ref={videoRef}
              className="video-el"
              /* Pour le HLS (.m3u8) c'est hls.js qui alimente l'élément (voir effet
                 ci-dessus) ; pour un fichier direct on garde l'attribut src. */
              src={source && source.endsWith('.m3u8') ? undefined : source}
              playsInline
              preload="metadata"
            />
            {!ready && !videoError && (
              <div className="video-state" aria-live="polite">
                Chargement de la vidéo…
              </div>
            )}
            {videoError && (
              <div className="video-state error" role="alert">
                Source vidéo illisible.
              </div>
            )}
            {/* Watermark dynamique : identité + horloge, incrusté en tuiles.
               aria-hidden + pointer-events:none pour ne pas gêner l'usage.
               Plus le risque de capture est élevé, plus il est visible. */}
            <div
              className={`wm-layer${captureRisk >= 40 ? ' wm-strong' : ''}`}
              aria-hidden="true"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="wm-tile">
                  {watermark}
                </span>
              ))}
            </div>
            {/* Indicateur discret de risque de capture (hors occultation). */}
            {!guarded && captureRisk >= 40 && (
              <div
                className="capture-risk"
                role="status"
                title="Signaux de risque de capture"
              >
                Risque capture {captureRisk}/100
              </div>
            )}
            {/* Occultation "vidéo noir" quand la page n'est plus active/visible. */}
            {guarded && (
              <div className="capture-shield" role="status">
                <div className="capture-shield-mark">Lecture masquée</div>
                <div className="capture-shield-sub">
                  Revenez sur la fenêtre pour reprendre.
                </div>
              </div>
            )}
            <DrawingCanvas
              tool={tool}
              color={color}
              shapes={shapesToShow}
              onAddShape={handleAddShape}
              onBeginAnnotation={handleBeginAnnotation}
              onErase={handleErase}
              onTextPlace={handleTextPlace}
              onCursor={sendCursor}
              onBackgroundClick={togglePlay}
            />
            {/* Sous-titres incrustés (transcription P3), synchronisés au temps
               courant. pointer-events:none -> ne gêne ni le dessin ni le clic. */}
            {activeCaption && (
              <div className="video-captions" aria-hidden="true">
                <span>{activeCaption}</span>
              </div>
            )}
            {/* Curseurs des autres participants (temps réel) */}
            {peers
              .filter((p) => p.cursor)
              .map((p) => (
                <div
                  key={p.id}
                  className="remote-cursor"
                  style={{ left: `${p.cursor.x * 100}%`, top: `${p.cursor.y * 100}%` }}
                >
                  <Cursor size={18} weight="fill" color={p.color || p.cursor.color} />
                  <span
                    className="label"
                    style={{ background: p.color || p.cursor.color }}
                  >
                    {p.name || p.cursor.name}
                  </span>
                </div>
              ))}
          </div>

          {/* Input texte flottant */}
          {pendingText && (
            <div
              className="text-input-overlay"
              style={{
                left: `${pendingText.x * 100}%`,
                top: `${pendingText.y * 100}%`,
              }}
            >
              <textarea
                className="text-input-field"
                placeholder="Écrire…"
                autoFocus
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleTextSubmit(e.target.value)
                  }
                  if (e.key === 'Escape') setPendingText(null)
                }}
                onBlur={(e) => handleTextSubmit(e.target.value)}
              />
            </div>
          )}

          {/* Barre d'outils flottante (plein écran) */}
          {fullscreen && (
            <div className="fs-toolbar">
              <div className="fs-toolbar-tools">
                {TOOLS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className={`tool-btn${tool === id ? ' active' : ''}`}
                    onClick={() => setTool(id)}
                    title={label}
                    aria-label={label}
                    aria-pressed={tool === id}
                  >
                    <Icon size={16} weight={tool === id ? 'fill' : 'regular'} />
                  </button>
                ))}
                <span className="toolbar-sep" />
                <div className="swatches">
                  {SWATCHES.map((s) => (
                    <button
                      key={s.value}
                      className={`swatch${color === s.value ? ' active' : ''}`}
                      style={{ background: s.value }}
                      onClick={() => setColor(s.value)}
                      title={s.name}
                      aria-label={`Couleur ${s.name}`}
                    />
                  ))}
                </div>
                <span className="toolbar-sep" />
                <button
                  className="tool-btn"
                  onClick={() => {
                    if (activeId) {
                      const note = notes.find((n) => n.id === activeId)
                      if (note && note.shapes?.length) updateNoteShapes(note.id, [])
                    } else {
                      clearDraft()
                    }
                  }}
                  title="Effacer tout"
                  aria-label="Effacer tout"
                >
                  <TrashSimple size={16} />
                </button>
                <button
                  className="tool-btn"
                  onClick={toggleFullscreen}
                  title="Quitter le plein écran"
                  aria-label="Quitter le plein écran"
                >
                  <ArrowsInSimple size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="controls">
          <div
            className={`scrubber${following ? ' locked' : ''}`}
            ref={scrubRef}
            onClick={scrubToEvent}
            role="slider"
            aria-label="Progression de la vidéo"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
            onKeyDown={handleScrubberKey}
          >
            <div className="scrubber-track" />
            <div className="scrubber-fill" style={{ width: `${progress}%` }} />
            {/* Marqueurs des commentaires */}
            {duration > 0 &&
              notes.map((n) => (
                <span
                  key={n.id}
                  className="scrubber-marker"
                  role="button"
                  tabIndex={0}
                  style={{
                    left: `${(n.time / duration) * 100}%`,
                    background: n.color || n.author.color,
                  }}
                  title={`${formatTime(n.time)} — ${n.author.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectNote(n)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectNote(n)
                    }
                  }}
                />
              ))}
            <div className="scrubber-head" style={{ left: `${progress}%` }} />
          </div>

          <div className="controls-row">
            <button
              className="play-btn"
              onClick={togglePlay}
              disabled={following}
              aria-label={playing ? 'Pause' : 'Lecture'}
              title={following ? `Lecture pilotée par ${presenterName}` : undefined}
            >
              {playing ? (
                <Pause size={20} weight="fill" />
              ) : (
                <Play size={20} weight="fill" />
              )}
            </button>
            <span className="timecode">
              <b>{formatTime(currentTime)}</b> / {ready ? formatTime(duration) : '–:––'}
            </span>

            {/* Watch Together : prise/abandon de la présentation */}
            {isPresenter ? (
              <button
                className="badge badge-accent wt-badge"
                onClick={releasePresenter}
                title="Arrêter de présenter"
              >
                <Broadcast size={13} weight="fill" /> Vous présentez · Arrêter
              </button>
            ) : following ? (
              <button
                className="badge wt-badge"
                onClick={claimPresenter}
                title="Reprendre la main"
              >
                <Eye size={13} weight="fill" /> Suit {presenterName} · Reprendre
              </button>
            ) : (
              <button
                className="badge wt-badge"
                onClick={claimPresenter}
                title="Synchroniser la lecture pour tous les invités"
              >
                <Broadcast size={13} /> Présenter
              </button>
            )}

            {/* Volume : clic sur l'icône ouvre la barre (avec le %). */}
            <div className="ctrl-menu">
              {volOpen && (
                <div className="ctrl-backdrop" onClick={() => setVolOpen(false)} />
              )}
              <button
                className="badge wt-badge"
                onClick={() => setVolOpen((v) => !v)}
                aria-label="Volume"
                aria-expanded={volOpen}
                title={`Volume ${Math.round((muted ? 0 : volume) * 100)}%`}
                style={{ marginLeft: '12px', padding: '0 6px' }}
              >
                {muted || volume === 0 ? (
                  <SpeakerSlash size={16} weight="fill" />
                ) : volume < 0.5 ? (
                  <SpeakerLow size={16} weight="fill" />
                ) : (
                  <SpeakerHigh size={16} weight="fill" />
                )}
              </button>
              {volOpen && (
                <div className="ctrl-pop ctrl-pop-vol" role="group" aria-label="Volume">
                  <span className="vol-pct">
                    {Math.round((muted ? 0 : volume) * 100)}%
                  </span>
                  <input
                    type="range"
                    className="vol-slider"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setVolume(val)
                      setMuted(val === 0)
                    }}
                    aria-label="Niveau du volume"
                  />
                </div>
              )}
            </div>

            {/* Vitesse : un bouton (vitesse active) qui déploie les 4 options. */}
            <div className="ctrl-menu">
              {speedOpen && (
                <div className="ctrl-backdrop" onClick={() => setSpeedOpen(false)} />
              )}
              <button
                className={`badge ${playbackRate !== 1 ? 'badge-accent' : 'wt-badge'}`}
                onClick={() => !following && setSpeedOpen((v) => !v)}
                disabled={following}
                aria-expanded={speedOpen}
                title={
                  following ? 'Vitesse pilotée par le présentateur' : 'Vitesse de lecture'
                }
                style={{
                  marginLeft: '8px',
                  padding: '0 6px',
                  opacity: following ? 0.5 : 1,
                }}
              >
                <Gauge size={15} weight="bold" /> {playbackRate}x
              </button>
              {speedOpen && (
                <div className="ctrl-pop ctrl-pop-speed" role="menu" aria-label="Vitesse">
                  {[0.5, 1, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      role="menuitemradio"
                      aria-checked={playbackRate === rate}
                      className={`speed-opt${playbackRate === rate ? ' active' : ''}`}
                      onClick={() => {
                        setRate(rate)
                        setSpeedOpen(false)
                      }}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {captionSegments.length > 0 && (
              <button
                className={`badge ${captionsOn ? 'badge-accent' : 'wt-badge'}`}
                onClick={() => setCaptionsOn((v) => !v)}
                aria-pressed={captionsOn}
                title={
                  captionsOn ? 'Masquer les sous-titres' : 'Afficher les sous-titres'
                }
                style={{ marginLeft: '8px', padding: '0 6px' }}
              >
                <ClosedCaptioning size={15} weight={captionsOn ? 'fill' : 'regular'} />
              </button>
            )}

            <div className="controls-spacer" />

            {/* Barre d'outils d'annotation */}
            <div className="toolbar" role="toolbar" aria-label="Outils d'annotation">
              {TOOLS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={`tool-btn${tool === id ? ' active' : ''}`}
                  onClick={() => setTool(id)}
                  title={label}
                  aria-label={label}
                  aria-pressed={tool === id}
                >
                  <Icon size={17} weight={tool === id ? 'fill' : 'regular'} />
                </button>
              ))}
              <span className="toolbar-sep" />
              <div className="swatches">
                {SWATCHES.map((s) => (
                  <button
                    key={s.value}
                    className={`swatch${color === s.value ? ' active' : ''}`}
                    style={{ background: s.value }}
                    onClick={() => setColor(s.value)}
                    title={s.name}
                    aria-label={`Couleur ${s.name}`}
                  />
                ))}
              </div>
            </div>

            <button
              className="btn-icon"
              onClick={exportJSON}
              title="Exporter en JSON"
              aria-label="Exporter"
            >
              <DownloadSimple size={18} />
            </button>
            <button
              className="btn-icon"
              onClick={() => fileRef.current?.click()}
              title="Importer un JSON"
              aria-label="Importer"
            >
              <UploadSimple size={18} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => importJSON(e.target.files?.[0])}
            />
            <span className="toolbar-sep" />
            <button
              className="btn-icon"
              onClick={() => {
                if (activeId) {
                  const note = notes.find((n) => n.id === activeId)
                  if (note && note.shapes?.length) updateNoteShapes(note.id, [])
                } else {
                  clearDraft()
                }
              }}
              title="Effacer tous les dessins"
              aria-label="Effacer les dessins"
            >
              <TrashSimple size={18} />
            </button>
            <button
              className="btn-icon"
              onClick={toggleFullscreen}
              title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            >
              {fullscreen ? <ArrowsInSimple size={18} /> : <ArrowsOutSimple size={18} />}
            </button>
          </div>
        </div>

        {/* Insights IA (Pôle 3) : sous le player, pleine largeur de la colonne */}
        <InsightsPanel
          contentId={contentId}
          meta={meta}
          onSeek={seekTo}
          currentTime={currentTime}
        />
      </div>

      <CommentPanel
        user={self}
        notes={notes}
        activeId={activeId}
        onSelect={selectNote}
        onEdit={editNote}
        onReply={replyToNote}
        onResolve={resolveNote}
        onDelete={(n) => removeNote(n.id)}
        canDelete={canDelete}
        onToggleLike={toggleLike}
        onAddReply={addReply}
        onDeleteReply={deleteReply}
        peerCount={peers.length}
        composeTime={composeTime}
        draftCount={draftShapes.length}
        text={text}
        isEditing={Boolean(editingId)}
        onText={handleTextChange}
        onSubmit={submitNote}
        onClearDraft={clearDraft}
      />
    </div>
  )
}
