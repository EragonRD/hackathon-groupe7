import { useState } from 'react'
import {
  FilmSlate,
  Plus,
  Warning,
  LockKey,
  LockKeyOpen,
  UserPlus,
  X,
} from '@phosphor-icons/react'
import {
  createContent,
  grantAccess,
  revokeAccess,
  revokeKey,
  restoreKey,
} from '../../admin'

// Admin : crée un contenu, gère qui y a accès, et coupe / rétablit la clé AES en
// direct (révocation = GET /keys/:id passe à 403 immédiatement, la lecture cesse).
export default function ContentsPanel({
  contents,
  users,
  companies,
  superadmin,
  reload,
}) {
  const [title, setTitle] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const needsCompany = superadmin
  const canSubmit = title.trim() && (!needsCompany || companyId) && !busy

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setBusy(true)
    try {
      await createContent({
        title: title.trim(),
        ...(needsCompany ? { companyId } : {}),
      })
      setTitle('')
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
          <label className="field-label" htmlFor="ct-title">
            Nouveau contenu
          </label>
          <div className="input-wrap">
            <FilmSlate className="input-icon" size={17} weight="bold" />
            <input
              id="ct-title"
              className="has-icon"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex. Teaser saison 2"
            />
          </div>
        </div>

        {needsCompany && (
          <div className="field admin-field">
            <label className="field-label" htmlFor="ct-company">
              Entreprise
            </label>
            <select
              id="ct-company"
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
            <Plus size={15} weight="bold" />
          )}
          Créer
        </button>
      </form>

      {error && (
        <div className="error-text" role="alert">
          <Warning size={16} weight="fill" />
          {error}
        </div>
      )}

      {contents.length === 0 ? (
        <div className="empty admin-empty">
          <FilmSlate size={34} weight="light" />
          <p>Aucun contenu. Créez le premier ci-dessus.</p>
        </div>
      ) : (
        <ul className="admin-list">
          {contents.map((c) => (
            <ContentRow
              key={c.id}
              content={c}
              users={users}
              superadmin={superadmin}
              companies={companies}
              reload={reload}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ContentRow({ content, users, superadmin, companies, reload }) {
  const [add, setAdd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Utilisateurs de la même entreprise que le contenu (le Core exige ce lien).
  const candidates = users.filter(
    (u) =>
      u.companyId === content.companyId && !content.allowedUsernames.includes(u.username),
  )
  const companyName =
    companies.find((c) => c.id === content.companyId)?.name ?? content.companyId

  async function run(action) {
    setError(null)
    setBusy(true)
    try {
      await action()
      await reload()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submitAdd(e) {
    e.preventDefault()
    const value = add.trim()
    if (!value || busy) return
    const ok = await run(() => grantAccess(content.id, value))
    if (ok) setAdd('')
  }

  return (
    <li className="admin-row admin-row-col">
      <div className="admin-row-main">
        <span className="admin-row-title">
          <FilmSlate size={16} weight="fill" />
          {content.title}
        </span>
        <code className="admin-id">{content.id}</code>
        {superadmin && <span className="admin-muted">{companyName}</span>}
        <span className="admin-row-spacer" />
        <span className={`badge ${content.revoked ? 'badge-danger' : 'badge-ok'}`}>
          {content.revoked ? (
            <>
              <LockKey size={12} weight="fill" />
              Clé révoquée
            </>
          ) : (
            <>
              <LockKeyOpen size={12} weight="fill" />
              Clé active
            </>
          )}
        </span>
        <button
          className="btn btn-ghost admin-key-btn"
          disabled={busy}
          onClick={() =>
            run(() => (content.revoked ? restoreKey(content.id) : revokeKey(content.id)))
          }
        >
          {content.revoked ? 'Rétablir la clé' : 'Révoquer la clé'}
        </button>
      </div>

      <div className="admin-access">
        <span className="admin-access-label">Accès</span>
        <div className="admin-chips">
          {content.allowedUsernames.length === 0 ? (
            <span className="admin-muted">Personne pour l'instant.</span>
          ) : (
            content.allowedUsernames.map((name) => (
              <span key={name} className="chip">
                {name}
                <button
                  type="button"
                  className="chip-remove"
                  disabled={busy}
                  onClick={() => run(() => revokeAccess(content.id, name))}
                  title={`Retirer l'accès de ${name}`}
                  aria-label={`Retirer l'accès de ${name}`}
                >
                  <X size={12} weight="bold" />
                </button>
              </span>
            ))
          )}
        </div>

        <form className="admin-inline-form admin-access-add" onSubmit={submitAdd}>
          <div className="input-wrap admin-grow">
            <UserPlus className="input-icon" size={16} weight="bold" />
            <input
              className="has-icon"
              list={`users-${content.id}`}
              value={add}
              onChange={(e) => setAdd(e.target.value)}
              placeholder="identifiant à autoriser"
              aria-label={`Donner accès à ${content.title}`}
            />
            <datalist id={`users-${content.id}`}>
              {candidates.map((u) => (
                <option key={u.username} value={u.username} />
              ))}
            </datalist>
          </div>
          <button className="btn btn-ghost" type="submit" disabled={!add.trim() || busy}>
            <Plus size={15} weight="bold" />
            Autoriser
          </button>
        </form>
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
