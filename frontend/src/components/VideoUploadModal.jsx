import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X,
  FilmSlate,
  UserPlus,
  CaretRight,
  Clock,
  HardDrive,
} from '@phosphor-icons/react'
import { authFetch } from '../auth'
import { formatTime } from '../lib/format'

const CATEGORIES = [
  'Présentation',
  'Marketing',
  'Conférence',
  'Tutoriel',
  'Produit',
  'Autre',
]

function nameFromFile(file) {
  if (!file) return ''
  return file.name.replace(/\.[^.]+$/, '')
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function VideoUploadModal({ file, onCancel, onConfirm }) {
  const [title, setTitle] = useState(nameFromFile(file))
  const [category, setCategory] = useState(CATEGORIES[0])
  const [inviteInput, setInviteInput] = useState('')
  const [invited, setInvited] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [fetching, setFetching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [duration, setDuration] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [posterUrl, setPosterUrl] = useState(null)
  const inputRef = useRef(null)
  const suggestRef = useRef(null)
  const fetchId = useRef(0)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    Promise.resolve().then(() => setVideoUrl(url))
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!videoUrl) return
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.setAttribute('playsinline', '')
    video.src = videoUrl
    video.addEventListener('loadedmetadata', () => {
      Promise.resolve().then(() => {
        setDuration(video.duration)
      })
      video.currentTime = Math.min(video.duration, 1)
    })
    video.addEventListener('seeked', () => {
      Promise.resolve().then(() => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setPosterUrl(canvas.toDataURL('image/jpeg', 0.6))
      })
    })
    video.load()
  }, [videoUrl])

  useEffect(() => {
    const q = inviteInput.trim().replace(/^@/, '')
    const id = ++fetchId.current
    Promise.resolve().then(() => {
      if (id !== fetchId.current) return
      if (!q) {
        setSuggestions([])
        setShowSuggestions(false)
        setFetching(false)
        return
      }
      setFetching(true)
      authFetch(`/auth/users?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((users) => {
          if (id === fetchId.current) {
            const filtered = users.filter((u) => !invited.includes(u.username))
            setSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
            setFetching(false)
          }
        })
        .catch(() => {
          if (id === fetchId.current) setFetching(false)
        })
    })
  }, [inviteInput, invited])

  useEffect(() => {
    function handleClick(e) {
      if (
        suggestRef.current &&
        !suggestRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function addInvite(user) {
    if (!invited.includes(user.username)) {
      setInvited([...invited, user.username])
    }
    setInviteInput('')
    setSuggestions([])
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  function removeInvite(name) {
    setInvited(invited.filter((n) => n !== name))
  }

  function handleKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ',') && inviteInput.trim()) {
      e.preventDefault()
      const q = inviteInput.replace(/^@/, '').trim()
      if (q) addInvite({ username: q })
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // On NE bloque PLUS ici : on remonte les paramètres au parent, qui lance
  // l'envoi + le chiffrement en tâche de fond (toast non bloquant). Le modal se
  // ferme aussitôt et le site reste utilisable.
  const handleConfirm = useCallback(() => {
    if (!file) return
    onConfirm({
      file,
      title: title.trim() || nameFromFile(file),
      category,
      invited,
    })
  }, [title, file, category, invited, onConfirm])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <FilmSlate size={20} weight="fill" color="var(--accent-strong)" />
          <span>Ajouter une vidéo</span>
          <button className="btn-icon modal-close" onClick={onCancel}>
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="modal-body">
          <div className="upload-preview">
            {posterUrl ? (
              <img src={posterUrl} alt="" className="upload-thumb" />
            ) : (
              <div className="upload-thumb upload-thumb-placeholder">
                <FilmSlate size={32} weight="light" color="var(--text-faint)" />
              </div>
            )}
            <div className="upload-file-info">
              <span className="upload-file-name">{file?.name}</span>
              <div className="upload-file-meta">
                {duration != null && (
                  <span>
                    <Clock size={12} weight="bold" />
                    {formatTime(duration)}
                  </span>
                )}
                {file?.size != null && (
                  <span>
                    <HardDrive size={12} weight="bold" />
                    {formatSize(file.size)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la vidéo"
            />
          </div>

          <div className="field">
            <label className="field-label">Catégorie</label>
            <div className="category-picker">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className={`category-chip${category === c ? ' active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              <UserPlus size={14} weight="bold" />
              Inviter des collaborateurs
            </label>
            <div className="invite-area">
              <div className="invite-input-wrap">
                {invited.length > 0 && (
                  <div className="invite-chips">
                    {invited.map((name) => (
                      <span key={name} className="invite-chip">
                        {name}
                        <button
                          className="invite-chip-remove"
                          onClick={() => removeInvite(name)}
                        >
                          <X size={10} weight="bold" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="invite-field-row">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (suggestions.length > 0) setShowSuggestions(true)
                    }}
                    placeholder="alice, bob, carol…"
                  />
                  {fetching && <span className="invite-spinner" />}
                </div>
              </div>
              {showSuggestions && (
                <div className="invite-suggestions" ref={suggestRef}>
                  {suggestions.map((user) => (
                    <button
                      key={user.id}
                      className="invite-suggestion"
                      onClick={() => addInvite(user)}
                    >
                      <span className="invite-sugg-avatar">
                        {user.username[0].toUpperCase()}
                      </span>
                      <div className="invite-sugg-info">
                        <span className="invite-sugg-name">{user.username}</span>
                        {user.email && (
                          <span className="invite-sugg-email">{user.email}</span>
                        )}
                      </div>
                      <span className="invite-sugg-role">{user.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!title.trim()}
          >
            <CaretRight size={15} weight="bold" />
            Chiffrer et publier
          </button>
        </div>
      </div>
    </div>
  )
}
