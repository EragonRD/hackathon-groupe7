import { useState } from 'react'
import { WarningCircle, ArrowClockwise, SignOut } from '@phosphor-icons/react'

// Alerte mono-session : le compte vient d'être ouvert ailleurs (le dernier login
// gagne). S'affiche EN OVERLAY par-dessus la page courante, sans y toucher.
//   onReconnect : reprise sans identifiants (refresh token / token valide) ; async.
//   onDismiss   : vrai logout -> écran de connexion.
export default function SessionEndedModal({ onReconnect, onDismiss }) {
  const [busy, setBusy] = useState(false)

  async function handleReconnect() {
    setBusy(true)
    try {
      await onReconnect()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-ended-title"
        aria-describedby="session-ended-desc"
      >
        <div className="modal-head">
          <WarningCircle size={18} weight="fill" />
          <span id="session-ended-title">Session fermée</span>
        </div>
        <div className="modal-body">
          <p id="session-ended-desc" className="sub">
            Vous avez été déconnecté par une autre session. Ce compte vient d'être ouvert
            ailleurs, et une seule session active est autorisée à la fois.
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onDismiss} disabled={busy}>
            <SignOut size={16} weight="bold" />
            Laisser la déconnexion
          </button>
          <button className="btn btn-primary" onClick={handleReconnect} disabled={busy}>
            {busy ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <ArrowClockwise size={16} weight="bold" />
            )}
            Se reconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
