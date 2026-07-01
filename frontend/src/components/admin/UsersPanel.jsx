import { useState } from 'react'
import {
  User,
  UserPlus,
  LockKey,
  Warning,
  UsersThree,
  Trash,
} from '@phosphor-icons/react'
import { createUser, setUserRole, deleteUser } from '../../admin'
import { getClaims } from '../../auth'

const ROLE_LABELS = { superadmin: 'Super-admin', admin: 'Admin', user: 'Utilisateur' }

// Admin : crée un utilisateur (role `user`) dans SON entreprise. Un superadmin
// doit choisir l'entreprise cible (companyId requis côté Core). Le superadmin
// peut aussi changer le rôle (admin/user) et supprimer ; un admin supprime les
// comptes de sa société. Personne ne peut supprimer son propre compte.
export default function UsersPanel({ users, companies, superadmin, reload }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const me = getClaims()
  const needsCompany = superadmin
  const canSubmit =
    username.trim() && password.length > 0 && (!needsCompany || companyId) && !busy

  function companyName(id) {
    return companies.find((c) => c.id === id)?.name ?? id ?? 'inconnu'
  }

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setBusy(true)
    try {
      await createUser({
        username: username.trim(),
        password,
        ...(needsCompany ? { companyId } : {}),
      })
      setUsername('')
      setPassword('')
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-section">
      <form className="admin-form admin-form-wrap" onSubmit={submit}>
        <div className="field admin-field">
          <label className="field-label" htmlFor="us-name">
            Identifiant
          </label>
          <div className="input-wrap">
            <User className="input-icon" size={17} weight="bold" />
            <input
              id="us-name"
              className="has-icon"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. dave"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="field admin-field">
          <label className="field-label" htmlFor="us-pass">
            Mot de passe
          </label>
          <div className="input-wrap">
            <LockKey className="input-icon" size={17} weight="bold" />
            <input
              id="us-pass"
              type="password"
              className="has-icon"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mot de passe initial"
              autoComplete="new-password"
            />
          </div>
        </div>

        {needsCompany && (
          <div className="field admin-field">
            <label className="field-label" htmlFor="us-company">
              Entreprise
            </label>
            <select
              id="us-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Choisir…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          className="btn btn-primary admin-form-submit"
          type="submit"
          disabled={!canSubmit}
        >
          {busy ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <UserPlus size={15} weight="bold" />
          )}
          Ajouter
        </button>
      </form>

      {error && (
        <div className="error-text" role="alert">
          <Warning size={16} weight="fill" />
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="empty admin-empty">
          <UsersThree size={34} weight="light" />
          <p>Aucun utilisateur. Ajoutez le premier ci-dessus.</p>
        </div>
      ) : (
        <ul className="admin-list">
          {users.map((u) => (
            <UserRow
              key={u.id ?? u.username}
              user={u}
              superadmin={superadmin}
              isSelf={u.username === me?.username}
              companyLabel={superadmin ? companyName(u.companyId) : null}
              reload={reload}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function UserRow({ user, superadmin, isSelf, companyLabel, reload }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Le rôle n'est modifiable que par un superadmin, et jamais sur un superadmin.
  const canEditRole = superadmin && user.role !== 'superadmin'
  // Suppression interdite sur soi-même et sur un superadmin.
  const canDelete = !isSelf && user.role !== 'superadmin'

  async function changeRole(role) {
    if (role === user.role || busy) return
    setError(null)
    setBusy(true)
    try {
      await setUserRole(user.username, role)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await deleteUser(user.username)
      await reload()
    } catch (err) {
      setError(err.message)
      setBusy(false)
      setConfirmDelete(false)
    }
    // succès : la ligne disparaît au reload.
  }

  return (
    <li className="admin-row admin-row-col">
      <div className="admin-row-main">
        <span className="admin-row-title">
          <User size={16} weight="fill" />
          {user.username}
          {isSelf && <span className="admin-muted">(vous)</span>}
        </span>
        <span className="admin-row-meta">
          {user.email && <span className="admin-muted">{user.email}</span>}
          {companyLabel && <span className="admin-muted">{companyLabel}</span>}
        </span>

        <span className="admin-row-spacer" />

        {canEditRole ? (
          <label className="admin-role-select">
            <span className="admin-muted">Rôle</span>
            <select
              value={user.role}
              disabled={busy}
              onChange={(e) => changeRole(e.target.value)}
              aria-label={`Rôle de ${user.username}`}
            >
              <option value="user">Utilisateur</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        ) : (
          <span className={`badge ${user.role === 'user' ? '' : 'badge-accent'}`}>
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        )}

        {canDelete &&
          (confirmDelete ? (
            <span className="admin-confirm">
              <button className="btn btn-danger" disabled={busy} onClick={remove}>
                {busy ? <span className="spinner" aria-hidden="true" /> : 'Confirmer'}
              </button>
              <button
                className="btn btn-quiet"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              className="btn-icon admin-danger-icon"
              onClick={() => setConfirmDelete(true)}
              title={`Supprimer ${user.username}`}
              aria-label={`Supprimer ${user.username}`}
            >
              <Trash size={16} />
            </button>
          ))}
      </div>

      {error && (
        <div className="error-text" role="alert">
          <Warning size={15} weight="fill" />
          {error}
        </div>
      )}
    </li>
  )
}
