import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FilmSlate,
  Play,
  FolderOpen,
  LockSimple,
  LockKey,
  ShieldCheck,
  Gear,
  Warning,
  UsersThree,
  CircleNotch,
} from '@phosphor-icons/react'
import { isSuperAdmin } from '../auth'
import { listMyContents } from '../contents'
import { useUploads } from '../lib/uploads'
import VideoUploadModal from './VideoUploadModal'

// Catalogue.
// `onOpenSecure(content)` ouvre un contenu protégé de l'organisation (flux HLS
// Zero-Trust) ; `onOpenAdmin()` renvoie le superadmin vers le back-office (il
// n'a aucun contenu propre). L'upload local passe par VideoUploadModal qui
// chiffre la vidéo côté serveur, puis on l'ouvre comme un contenu protégé.
export default function Catalogue({ onOpenSecure, onOpenAdmin }) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)

  const superadmin = isSuperAdmin()
  const { uploads, startUpload } = useUploads()
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(!superadmin)
  const [error, setError] = useState(null)

  // Rechargement manuel (après un upload) : rafraîchit « Vos contenus ».
  const reloadContents = useCallback(async () => {
    try {
      const list = await listMyContents()
      setContents(list)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

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

  // Rafraîchissement périodique du catalogue tant que quelque chose bouge :
  //   - une vidéo est en cours de chiffrement côté serveur (barre "X%"), OU
  //   - un upload en tâche de fond (toast) transfère/chiffre.
  // -> la nouvelle carte apparaît, le % avance, et bascule en "prête" à la fin.
  const hasProcessing = contents.some((c) => c.status === 'processing')
  const hasActiveUpload = uploads.some(
    (u) => u.phase === 'uploading' || u.phase === 'encrypting',
  )
  useEffect(() => {
    if (superadmin || (!hasProcessing && !hasActiveUpload)) return undefined
    const id = setInterval(() => {
      reloadContents()
    }, 2500)
    return () => clearInterval(id)
  }, [superadmin, hasProcessing, hasActiveUpload, reloadContents])

  function handleFileSelected(file) {
    if (!file) return
    setUploadFile(file)
  }

  // Le modal ne fait plus que collecter les paramètres. On ferme aussitôt et on
  // lance l'envoi + le chiffrement en TÂCHE DE FOND (toast non bloquant) : le
  // site reste utilisable. La carte apparaît en "Chiffrement… X%" puis "prête",
  // et le toast propose "Ouvrir" à la fin.
  function handleUploadConfirm(params) {
    setUploadFile(null)
    if (params?.file) startUpload(params)
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
  const API =
    import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3000')

  const processing = content.status === 'processing'
  const failed = content.status === 'failed'
  const pct = Math.max(0, Math.min(100, Math.round(content.progress ?? 0)))

  const unavailable = content.revoked
    ? { label: 'Accès suspendu', icon: LockKey }
    : processing
      ? { label: `Chiffrement… ${pct}%`, icon: CircleNotch }
      : failed
        ? { label: 'Échec du chiffrement', icon: Warning }
        : !content.playable
          ? { label: 'Flux indisponible', icon: LockSimple }
          : null

  if (unavailable) {
    const Icon = unavailable.icon
    return (
      <button
        className="vid-card"
        disabled
        title={processing ? 'Chiffrement en cours — indisponible' : unavailable.label}
      >
        <div className="vid-thumb">
          {processing || failed ? (
            <FilmSlate size={34} weight="light" color="var(--text-faint)" />
          ) : (
            <img
              src={`${API}/videos/${content.id}/thumbnail.jpg`}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={(e) => (e.target.style.display = 'none')}
            />
          )}
          {processing && (
            <div
              className="enc-progress"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="enc-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="vid-meta">
          <div className="vid-title">{content.title}</div>
          <div className="vid-sub">
            <Icon size={13} weight="bold" className={processing ? 'spin' : undefined} />
            {unavailable.label}
            {content.guestUpload && (
              <span className="badge" title="Vidéo déposée par un invité">
                <UsersThree size={12} weight="bold" />
                Upload invité
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <button className="vid-card" onClick={() => onOpenSecure(content)}>
      <div className="vid-thumb">
        <ShieldCheck size={34} weight="light" color="var(--accent-strong)" />
        <img
          key={content.id}
          src={`${API}/videos/${content.id}/thumbnail.jpg`}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1,
          }}
          onError={(e) => (e.target.style.display = 'none')}
        />
        <div className="play-badge" style={{ zIndex: 2 }}>
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
          {content.guestUpload && (
            <span className="badge" title="Vidéo déposée par un invité">
              <UsersThree size={12} weight="bold" />
              Upload invité
            </span>
          )}
          Revue sur flux protégé
        </div>
      </div>
    </button>
  )
}
