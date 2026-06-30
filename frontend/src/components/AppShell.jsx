import { SignOut, CaretLeft, BookOpen } from '@phosphor-icons/react'
import PoulpiumMark from './PoulpiumMark'
import { colorForUser, initials } from '../lib/format'

// Barre supérieure + cadre de l'application.
// `onBack` (optionnel) affiche un retour ; `center` et `right` sont des slots.
export default function AppShell({
  user,
  onLogout,
  onBack,
  onHome,
  title,
  center,
  right,
  onOpenDocs,
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
          <button className="brand" onClick={onHome} title="Accueil">
            <PoulpiumMark size={28} />
            <span>
              Poulpium
              <small>Lecteur de revue augmenté</small>
            </span>
          </button>
        )}

        {title && (
          <span style={{ fontWeight: 600, color: 'var(--text-dim)' }} title={title}>
            {title}
          </span>
        )}

        <div className="topbar-spacer" />

        {center}
        {right}

        <button
          className="btn-icon"
          onClick={onOpenDocs}
          title="Documentation"
          aria-label="Documentation"
        >
          <BookOpen size={18} />
        </button>

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
