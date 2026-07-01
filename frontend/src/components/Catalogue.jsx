import { useEffect, useRef, useState } from 'react'
import {
  FilmSlate,
  Play,
  FolderOpen,
  LockSimple,
  LockKey,
  ShieldCheck,
  Gear,
  Warning,
} from '@phosphor-icons/react'
import { SAMPLE } from '../data/videos'
import { shortId } from '../lib/format'
import { isSuperAdmin } from '../auth'
import { listMyContents } from '../contents'
import VideoUploadModal from './VideoUploadModal'

// Catalogue.
// `onOpen(video)` ouvre une vidéo locale (lecteur) ; `onOpenSecure(contentId)`
// ouvre un contenu protégé de l'organisation (flux Zero-Trust) ; `onOpenAdmin()`
// renvoie le superadmin vers le back-office (il n'a aucun contenu propre).
export default function Catalogue({ onOpen, onOpenSecure, onOpenAdmin }) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)

  const superadmin = isSuperAdmin()
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(!superadmin)
  const [error, setError] = useState(null)

  // Contenus de l'organisation (aucun pour un superadmin : il gère la plateforme,
  // pas le contenu). setState seulement APRÈS le await (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (superadmin) return undefined
    let alive = true
    ;(async () => {
      try {
        const list = await listMyContents()
        if (!alive) return
        setContents(list)
        setError(null)
      } catch (err) {
        if (alive) setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [superadmin])

  function handleFileSelected(file) {
    if (!file) return
    setUploadFile(file)
  }

  function handleUploadConfirm(meta) {
    const url = URL.createObjectURL(uploadFile)
    onOpen({
      id: `local-${shortId()}`,
      title: meta.title,
      src: url,
      session: 'local',
      playable: true,
      category: meta.category,
      invited: meta.invited,
    })
    setUploadFile(null)
  }

  function handleUploadCancel() {
    setUploadFile(null)
  }

  return (
    <div className="scroll-area">
      <div className="catalogue">
        <div className="cat-head">
          <div>
            <h1>Catalogue</h1>
            <p>
              {superadmin
                ? 'Vous gérez la plateforme. Les contenus appartiennent aux organisations.'
                : 'Vos contenus protégés, ou une vidéo locale à visionner.'}
            </p>
          </div>
        </div>

        {/* Superadmin : aucun contenu propre, renvoi vers le back-office. */}
        {superadmin ? (
          <div className="empty catalogue-empty">
            <ShieldCheck size={38} weight="light" />
            <p>Aucun contenu ici. La gestion se fait dans l'espace Administration.</p>
            {onOpenAdmin && (
              <button className="btn btn-primary" onClick={onOpenAdmin}>
                <Gear size={16} weight="bold" />
                Ouvrir l'administration
              </button>
            )}
          </div>
        ) : (
          <>
            <h2 className="cat-section">Vos contenus</h2>
            {error && (
              <div className="error-text" role="alert">
                <Warning size={16} weight="fill" />
                {error}
              </div>
            )}
            {loading ? (
              <div className="cat-grid">
                <div className="vid-card vid-card-skeleton" aria-hidden="true" />
                <div className="vid-card vid-card-skeleton" aria-hidden="true" />
              </div>
            ) : contents.length === 0 && !error ? (
              <div className="empty catalogue-empty">
                <FilmSlate size={34} weight="light" />
                <p>Aucun contenu accessible pour le moment.</p>
              </div>
            ) : (
              <div className="cat-grid">
                {contents.map((c) => (
                  <ContentCard key={c.id} content={c} onOpenSecure={onOpenSecure} />
                ))}
              </div>
            )}

            <h2 className="cat-section">Vidéos locales</h2>
            <div className="cat-grid">
              {/* Charger une vidéo locale (drag & drop ou sélection) -> modal */}
              <div
                className={`dropzone${dragging ? ' drag' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  handleFileSelected(e.dataTransfer.files?.[0])
                }}
              >
                <FolderOpen size={22} weight="light" />
                <div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => fileRef.current?.click()}
                  >
                    Charger une vidéo locale
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    hidden
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                  />
                </div>
              </div>

              {/* Vidéo de démonstration locale */}
              <button className="vid-card" onClick={() => onOpen({ ...SAMPLE })}>
                <div className="vid-thumb">
                  <FilmSlate size={34} weight="light" color="var(--text-faint)" />
                  <div className="play-badge">
                    <Play size={40} weight="fill" />
                  </div>
                </div>
                <div className="vid-meta">
                  <div className="vid-title">{SAMPLE.title}</div>
                  <div className="vid-sub">
                    <span className="badge badge-accent">Démo</span>
                    {SAMPLE.category}
                  </div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {uploadFile && (
        <VideoUploadModal
          file={uploadFile}
          onCancel={handleUploadCancel}
          onConfirm={handleUploadConfirm}
        />
      )}
    </div>
  )
}

// Carte d'un contenu de l'organisation. Cliquable si `playable` (clé provisionnée
// et non révoquée) ; sinon désactivée avec un badge d'état.
function ContentCard({ content, onOpenSecure }) {
  const unavailable = content.revoked
    ? { label: 'Accès suspendu', icon: LockKey }
    : !content.playable
      ? { label: 'Flux indisponible', icon: LockSimple }
      : null

  if (unavailable) {
    const Icon = unavailable.icon
    return (
      <button className="vid-card" disabled title={unavailable.label}>
        <div className="vid-thumb">
          <FilmSlate size={34} weight="light" color="var(--text-faint)" />
        </div>
        <div className="vid-meta">
          <div className="vid-title">{content.title}</div>
          <div className="vid-sub">
            <Icon size={13} weight="bold" />
            {unavailable.label}
          </div>
        </div>
      </button>
    )
  }

  return (
    <button className="vid-card" onClick={() => onOpenSecure(content)}>
      <div className="vid-thumb">
        <ShieldCheck size={34} weight="light" color="var(--accent-strong)" />
        <div className="play-badge">
          <Play size={40} weight="fill" />
        </div>
      </div>
      <div className="vid-meta">
        <div className="vid-title">{content.title}</div>
        <div className="vid-sub">
          <span className="badge badge-accent">
            <LockSimple size={12} weight="bold" />
            Protégé
          </span>
          Revue sur flux protégé
        </div>
      </div>
    </button>
  )
}
