import { useState } from 'react'
import {
  LockKey,
  Warning,
  Check,
  ArrowRight,
  Eye,
  EyeSlash,
  SignOut,
} from '@phosphor-icons/react'
import PoulpiumMark from './PoulpiumMark'
import { changePassword } from '../auth'

// Écran imposé à la 1re connexion d'un admin invité (token mustChangePassword).
// Tant que le mot de passe temporaire n'est pas remplacé, tout /admin/* est
// bloqué côté Core (403) : cet écran débloque l'onboarding.
export default function ChangePassword({ user, onDone, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('idle') // idle | busy | done
  const [show, setShow] = useState(false)

  // Validation locale (miroir des règles du Core : >= 8 caractères, différent).
  const tooShort = newPassword.length > 0 && newPassword.length < 8
  const mismatch = confirm.length > 0 && confirm !== newPassword
  const sameAsOld =
    newPassword.length > 0 &&
    currentPassword.length > 0 &&
    newPassword === currentPassword
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirm === newPassword &&
    !sameAsOld &&
    status === 'idle'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setStatus('busy')
    try {
      const updated = await changePassword(currentPassword, newPassword)
      setStatus('done')
      setTimeout(() => onDone?.(updated), 500)
    } catch (err) {
      setError(err.message || 'Impossible de changer le mot de passe.')
      setStatus('idle')
    }
  }

  return (
    <div className="pwd-screen">
      <form className="pwd-card" onSubmit={handleSubmit}>
        <div className="login-card-brand">
          <PoulpiumMark size={26} />
          <span>Poulpium</span>
        </div>

        <h2 className="login-title">Choisissez votre mot de passe</h2>
        <p className="sub">
          Bienvenue {user?.username}. Pour activer votre accès administrateur, remplacez
          le mot de passe temporaire reçu par email.
        </p>

        <div className="field">
          <label className="field-label" htmlFor="cp-current">
            Mot de passe temporaire
          </label>
          <div className="input-wrap">
            <LockKey className="input-icon" size={17} weight="bold" />
            <input
              id="cp-current"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              className="has-icon"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="celui reçu par email"
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cp-new">
            Nouveau mot de passe
          </label>
          <div className="input-wrap">
            <LockKey className="input-icon" size={17} weight="bold" />
            <input
              id="cp-new"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              className="has-icon has-action"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="au moins 8 caractères"
              aria-invalid={tooShort || sameAsOld}
            />
            <button
              type="button"
              className="input-action"
              onClick={() => setShow((s) => !s)}
              aria-label={
                show ? 'Masquer les mots de passe' : 'Afficher les mots de passe'
              }
              title={show ? 'Masquer' : 'Afficher'}
            >
              {show ? <EyeSlash size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {tooShort && <span className="field-error">8 caractères minimum.</span>}
          {sameAsOld && (
            <span className="field-error">
              Le nouveau doit différer du mot de passe temporaire.
            </span>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="cp-confirm">
            Confirmez le nouveau mot de passe
          </label>
          <div className="input-wrap">
            <LockKey className="input-icon" size={17} weight="bold" />
            <input
              id="cp-confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              className="has-icon"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="ressaisissez le mot de passe"
              aria-invalid={mismatch}
            />
          </div>
          {mismatch && (
            <span className="field-error">Les deux saisies ne correspondent pas.</span>
          )}
        </div>

        {error && (
          <div className="error-text" role="alert">
            <Warning size={16} weight="fill" />
            {error}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
          {status === 'busy' && (
            <>
              <span className="spinner" aria-hidden="true" />
              Enregistrement…
            </>
          )}
          {status === 'done' && (
            <>
              <Check size={17} weight="bold" />
              Mot de passe changé
            </>
          )}
          {status === 'idle' && (
            <>
              Valider et continuer
              <ArrowRight size={15} weight="bold" />
            </>
          )}
        </button>

        <button type="button" className="btn btn-quiet pwd-logout" onClick={onLogout}>
          <SignOut size={15} />
          Se déconnecter
        </button>
      </form>
    </div>
  )
}
