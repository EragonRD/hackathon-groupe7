import { useRef, useState } from 'react'
import {
  X,
  LinkSimple,
  Copy,
  Check,
  Warning,
  Clock,
  DownloadSimple,
} from '@phosphor-icons/react'
import { QRCodeCanvas } from 'qrcode.react'
import { inviteGuest } from '../contents'

const TTLS = [
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 heure' },
  { value: '24h', label: '24 heures' },
]

// Génère un lien d'invité temporaire pour un contenu et l'affiche, copiable.
// L'invité ouvre ce lien SANS compte : il rejoint la revue (watch-together,
// commentaires, dessin) jusqu'à expiration, puis l'accès à la vidéo cesse.
export default function InviteGuestModal({ content, onClose }) {
  const [ttl, setTtl] = useState('1h')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const qrRef = useRef(null)

  // Télécharge le QR affiché en PNG (le <canvas> se sérialise sans réseau).
  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `invitation-${content.id}.png`
    a.click()
  }

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const res = await inviteGuest(content.id, ttl)
      // On construit le lien depuis l'origine RÉELLE du front (le shareUrl du
      // backend dépend d'APP_URL, qui peut pointer un autre port/domaine).
      setLink(`${window.location.origin}/?guest=${res.token}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* presse-papiers indisponible : l'utilisateur peut sélectionner le texte */
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <LinkSimple size={18} weight="bold" />
          Inviter des participants
          <button className="btn-icon modal-close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="sub">
            Partagez un lien temporaire pour «&nbsp;{content.title}&nbsp;». Les invités
            rejoignent la revue sans compte et perdent l'accès à l'expiration.
          </p>

          <div className="field">
            <label className="field-label" htmlFor="invite-ttl">
              <Clock size={14} weight="bold" /> Durée de validité
            </label>
            <select id="invite-ttl" value={ttl} onChange={(e) => setTtl(e.target.value)}>
              {TTLS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="error-text" role="alert">
              <Warning size={16} weight="fill" />
              {error}
            </div>
          )}

          {!link ? (
            <button
              className="btn btn-primary invite-gen"
              onClick={generate}
              disabled={busy}
            >
              {busy ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <LinkSimple size={16} weight="bold" />
              )}
              Générer le lien
            </button>
          ) : (
            <div className="invite-box">
              <span className="invite-box-head">
                <Check size={15} weight="bold" />
                Lien prêt (valable {TTLS.find((t) => t.value === ttl)?.label})
              </span>
              <div className="copy-row">
                <code className="copy-row-value">{link}</code>
                <button
                  className="btn-icon"
                  onClick={copy}
                  title="Copier"
                  aria-label="Copier le lien"
                >
                  {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
                </button>
              </div>

              <div className="invite-qr">
                <div className="invite-qr-tile" ref={qrRef}>
                  <QRCodeCanvas
                    value={link}
                    size={168}
                    marginSize={2}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0a0c0f"
                  />
                </div>
                <button className="btn btn-ghost invite-qr-dl" onClick={downloadQr}>
                  <DownloadSimple size={15} weight="bold" />
                  Télécharger le QR
                </button>
                <p className="invite-qr-hint">
                  Scannez pour rejoindre depuis un téléphone.
                </p>
              </div>

              <p className="invite-box-note">
                Toute personne disposant de ce lien peut rejoindre jusqu'à l'expiration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
