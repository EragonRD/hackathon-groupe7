import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Play,
  Pause,
  Cursor,
  PencilSimple,
  ArrowUpRight,
  Rectangle,
  DownloadSimple,
  UploadSimple,
} from '@phosphor-icons/react'
import DrawingCanvas from './DrawingCanvas'
import CommentPanel from './CommentPanel'
import { useReview } from '../lib/useReview'
import { formatTime } from '../lib/format'

// ============================================================================
//  VideoReview — composant de revue autonome et réutilisable.
//  Props :
//    source  : URL de la vidéo (string)
//    session : identifiant de session de revue (string) — sert de "room"
//    user    : { id?, username, role } (utilisé comme auteur + couleur)
//  Tout l'état (notes, présence, curseurs) vit dans useReview et se synchronise
//  via la couche collab. Aucune dépendance au reste de l'application.
// ============================================================================

const TOOLS = [
  { id: 'cursor', label: 'Curseur', Icon: Cursor },
  { id: 'pen', label: 'Trait libre', Icon: PencilSimple },
  { id: 'arrow', label: 'Flèche', Icon: ArrowUpRight },
  { id: 'rect', label: 'Cadre', Icon: Rectangle },
]

const SWATCHES = [
  { name: 'Ambre', value: '#f5a623' },
  { name: 'Rouge', value: '#ff5b5b' },
  { name: 'Vert', value: '#2ec27e' },
  { name: 'Cyan', value: '#29c5e6' },
  { name: 'Violet', value: '#b07bff' },
  { name: 'Blanc', value: '#f4f6fa' },
]

export default function VideoReview({ source, session, user }) {
  const videoRef = useRef(null)
  const fileRef = useRef(null)

  const { self, notes, peers, addNote, removeNote, replaceNotes, sendCursor } = useReview(
    { session, user },
  )

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)

  const [tool, setTool] = useState('cursor')
  const [color, setColor] = useState('#f5a623')

  const [draftShapes, setDraftShapes] = useState([])
  const [pinnedTime, setPinnedTime] = useState(null)
  const [text, setText] = useState('')
  const [activeId, setActiveId] = useState(null)

  const composeTime = pinnedTime ?? currentTime
  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId],
  )

  // Le calque affiche le brouillon en cours, sinon les dessins de la note active.
  const shapesToShow = draftShapes.length > 0 ? draftShapes : (activeNote?.shapes ?? [])

  // --- Contrôle de la lecture --------------------------------------------
  const pause = useCallback(() => {
    videoRef.current?.pause()
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }, [])

  const seekTo = useCallback((t) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.max(0, Math.min(t, v.duration || t))
  }, [])

  // --- Annotation ---------------------------------------------------------
  // Première forme dessinée : on épingle l'instant et on met en pause.
  function handleAddShape(shape) {
    setDraftShapes((prev) => [...prev, shape])
    if (pinnedTime == null) {
      setPinnedTime(videoRef.current?.currentTime ?? currentTime)
      pause()
    }
    setActiveId(null)
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
    addNote({ time: composeTime, text, shapes: draftShapes, color })
    setDraftShapes([])
    setText('')
    setPinnedTime(null)
    setTool('cursor')
  }

  function selectNote(note) {
    setActiveId(note.id)
    setDraftShapes([])
    setPinnedTime(null)
    setText('')
    seekTo(note.time)
    pause()
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

  // --- Événements vidéo ---------------------------------------------------
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => setCurrentTime(v.currentTime)
    const onMeta = () => {
      setDuration(v.duration || 0)
      setReady(true)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [source])

  // Barre d'espace = play/pause (sauf en saisie de texte).
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
    const r = scrubRef.current.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    seekTo(frac * (duration || 0))
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <div className="review">
      <div className="review-main">
        <div className="stage">
          <div className="stage-inner">
            <video
              ref={videoRef}
              className="video-el"
              src={source}
              playsInline
              preload="metadata"
            />
            <DrawingCanvas
              tool={tool}
              color={color}
              shapes={shapesToShow}
              onAddShape={handleAddShape}
              onCursor={sendCursor}
              onBackgroundClick={togglePlay}
            />
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
        </div>

        <div className="controls">
          <div
            className="scrubber"
            ref={scrubRef}
            onClick={scrubToEvent}
            role="slider"
            aria-label="Progression de la vidéo"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
          >
            <div className="scrubber-track" />
            <div className="scrubber-fill" style={{ width: `${progress}%` }} />
            {/* Marqueurs des commentaires */}
            {duration > 0 &&
              notes.map((n) => (
                <span
                  key={n.id}
                  className="scrubber-marker"
                  style={{
                    left: `${(n.time / duration) * 100}%`,
                    background: n.color || n.author.color,
                  }}
                  title={`${formatTime(n.time)} — ${n.author.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    selectNote(n)
                  }}
                />
              ))}
            <div className="scrubber-head" style={{ left: `${progress}%` }} />
          </div>

          <div className="controls-row">
            <button
              className="play-btn"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Lecture'}
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
          </div>
        </div>
      </div>

      <CommentPanel
        notes={notes}
        activeId={activeId}
        onSelect={selectNote}
        onDelete={(n) => removeNote(n.id)}
        canDelete={canDelete}
        peerCount={peers.length}
        composeTime={composeTime}
        draftCount={draftShapes.length}
        text={text}
        onText={handleTextChange}
        onSubmit={submitNote}
        onClearDraft={clearDraft}
      />
    </div>
  )
}
