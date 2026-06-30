import { SignOut, CaretLeft } from '@phosphor-icons/react'
import PoulpiumMark from './PoulpiumMark'
import { colorForUser, initials } from '../lib/format'

// Barre supérieure + cadre de l'application.
// `onBack` (optionnel) affiche un retour ; `center` et `right` sont des slots.
export default function AppShell({
  user,
  onLogout,
  onBack,
  title,
  center,
  right,
  children,
}) {
  return (
    <div className="app">
      <header className="topbar">
        {onBack ? (
          <button className="btn btn-ghost" onClick={onBack}>
            <CaretLeft size={16} weight="bold" />
            Catalogue
          </button>
        ) : (
          <div className="brand">
            <PoulpiumMark size={28} />
            <span>
              Poulpium
              <small>Lecteur de revue augmenté</small>
            </span>
          </div>
        )}

        {title && (
          <span style={{ fontWeight: 600, color: 'var(--text-dim)' }} title={title}>
            {title}
          </span>
        )}

        <div className="topbar-spacer" />

        {center}
        {right}

        <div className="user-chip">
          <span
            className="avatar"
            style={{ background: colorForUser(user.id ?? user.username) }}
          >
            {initials(user.username)}
          </span>
          <span>
            <span className="who">{user.username}</span>
            <span className="role" style={{ display: 'block' }}>
              {user.role}
            </span>
          </span>
        </div>

        <button
          className="btn-icon"
          onClick={onLogout}
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <SignOut size={18} />
        </button>
      </header>

      {children}
    </div>
  )
}
