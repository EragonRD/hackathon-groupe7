import {
  X,
  CheckCircle,
  WarningCircle,
  ShieldCheck,
  UploadSimple,
} from '@phosphor-icons/react'
import { useUploads } from '../lib/uploads'

// Toasts d'upload NON BLOQUANTS (coin bas-droit). L'envoi + le chiffrement se
// suivent ici pendant qu'on continue d'utiliser le site. `onOpen(content)` ouvre
// la vidéo une fois prête.
export default function UploadToasts({ onOpen }) {
  const { uploads, dismiss } = useUploads()
  if (!uploads.length) return null

  return (
    <div className="upload-toasts" role="region" aria-label="Uploads en cours">
      {uploads.map((u) => {
        const pct = Math.max(0, Math.min(100, Math.round(u.progress || 0)))
        const active = u.phase === 'uploading' || u.phase === 'encrypting'
        return (
          <div key={u.id} className={`upload-toast ut-${u.phase}`} role="status">
            <div className="ut-head">
              <span className="ut-icon">
                {u.phase === 'ready' ? (
                  <CheckCircle size={16} weight="fill" />
                ) : u.phase === 'error' ? (
                  <WarningCircle size={16} weight="fill" />
                ) : u.phase === 'encrypting' ? (
                  <ShieldCheck size={16} weight="fill" />
                ) : (
                  <UploadSimple size={16} weight="fill" />
                )}
              </span>
              <span className="ut-title" title={u.title}>
                {u.title}
              </span>
              <button
                className="ut-close"
                onClick={() => dismiss(u.id)}
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={13} />
              </button>
            </div>

            <div className="ut-phase">
              {u.phase === 'uploading' && `Envoi… ${pct}%`}
              {u.phase === 'encrypting' && `Chiffrement Zero-Trust… ${pct}%`}
              {u.phase === 'ready' && 'Prête à visionner'}
              {u.phase === 'error' && (u.error || 'Échec')}
            </div>

            {active && (
              <div
                className="ut-track"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="ut-fill" style={{ width: `${pct}%` }} />
              </div>
            )}

            {u.phase === 'ready' && u.content && (
              <button
                className="ut-open"
                onClick={() => {
                  onOpen?.(u.content)
                  dismiss(u.id)
                }}
              >
                Ouvrir la vidéo
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
