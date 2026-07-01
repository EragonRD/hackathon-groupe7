import { useRef, useState } from 'react'
import { X, FilmSlate, UploadSimple, Check, Warning } from '@phosphor-icons/react'
import { uploadGuestContent } from '../contents'

// Upload par un invité : fichier + titre, puis envoi. La vidéo part vers
// l'équipe (membre invitant + admins) ; l'invité n'a pas à la revisionner, donc
// on confirme simplement l'envoi (le chiffrement se fait côté serveur).
export default function GuestUploadModal({ onClose }) {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('pick') // pick | sending | done
  const [error, setError] = useState(null)

  function pick(f) {
    if (!f) return
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function send() {
    if (!file || phase === 'sending') return
    setError(null)
    setPhase('sending')
    setProgress(0)
    try {
      await uploadGuestContent({
        file,
        title: title.trim() || file.name,
        onProgress: setProgress,
      })
      setPhase('done')
    } catch (e) {
      setError(e.message || "Échec de l'envoi.")
      setPhase('pick')
    }
  }

  return (
    <div className="modal-overlay" onClick={phase === 'sending' ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <UploadSimple size={18} weight="bold" />
          Ajouter une vidéo à la revue
          {phase !== 'sending' && (
            <button
              className="btn-icon modal-close"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="modal-body">
          {phase === 'done' ? (
            <div className="invite-box">
              <span className="invite-box-head">
                <Check size={15} weight="bold" />
                Vidéo envoyée
              </span>
              <p className="invite-box-note">
                Elle sera disponible pour l'équipe (l'hôte et ses administrateurs) une
                fois le traitement terminé.
              </p>
              <button className="btn btn-primary invite-gen" onClick={onClose}>
                Fermer
              </button>
            </div>
          ) : (
            <>
              <p className="sub">
                Votre vidéo sera partagée avec la personne qui vous a invité et les
                administrateurs de son organisation.
              </p>

              <div className="dropzone" style={{ marginBottom: 'var(--s-4)' }}>
                <FilmSlate size={22} weight="light" />
                <div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => fileRef.current?.click()}
                    disabled={phase === 'sending'}
                  >
                    {file ? 'Changer de fichier' : 'Choisir une vidéo'}
                  </button>
                  {file && <span className="admin-muted"> {file.name}</span>}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    hidden
                    onChange={(e) => pick(e.target.files?.[0])}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="guest-up-title">
                  Titre
                </label>
                <input
                  id="guest-up-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex. Ma démo"
                  disabled={phase === 'sending'}
                />
              </div>

              {error && (
                <div className="error-text" role="alert">
                  <Warning size={16} weight="fill" />
                  {error}
                </div>
              )}

              {phase === 'sending' ? (
                <>
                  <p style={{ fontWeight: 600 }}>
                    {progress < 100 ? 'Envoi de la vidéo…' : 'Traitement côté serveur…'}
                  </p>
                  <div className="progress-track">
                    <div
                      className={`progress-fill${progress >= 100 ? ' progress-indeterminate' : ''}`}
                      style={progress < 100 ? { width: `${progress}%` } : undefined}
                    />
                  </div>
                  <span className="progress-label">
                    {progress < 100 ? `${progress}%` : 'Finalisation…'}
                  </span>
                </>
              ) : (
                <button
                  className="btn btn-primary invite-gen"
                  onClick={send}
                  disabled={!file}
                >
                  <UploadSimple size={16} weight="bold" />
                  Envoyer
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
