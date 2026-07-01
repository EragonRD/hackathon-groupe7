import { useState } from 'react'
import {
  Buildings,
  Plus,
  EnvelopeSimple,
  Copy,
  Check,
  Warning,
  PaperPlaneTilt,
  Trash,
} from '@phosphor-icons/react'
import { createCompany, inviteAdmin, deleteCompany } from '../../admin'

// Super-admin : créer une entreprise (tenant) et inviter son administrateur.
// L'invitation renvoie un lien + un mot de passe temporaire (24 h) : on les
// affiche, copiables, car en mode email non configuré c'est le seul canal.
export default function CompaniesPanel({ companies, users, reload }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const value = name.trim()
    if (!value || busy) return
    setError(null)
    setBusy(true)
    try {
      await createCompany(value)
      setName('')
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-section">
      <form className="admin-form" onSubmit={submit}>
        <div className="field admin-field">
          <label className="field-label" htmlFor="co-name">
            Nouvelle entreprise
          </label>
          <div className="input-wrap">
            <Buildings className="input-icon" size={17} weight="bold" />
            <input
              id="co-name"
              className="has-icon"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Studio Marée Haute"
            />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={!name.trim() || busy}>
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

      {companies.length === 0 ? (
        <div className="empty admin-empty">
          <Buildings size={34} weight="light" />
          <p>Aucune entreprise pour le moment. Créez la première ci-dessus.</p>
        </div>
      ) : (
        <ul className="admin-list">
          {companies.map((c) => (
            <CompanyRow
              key={c.id}
              company={c}
              admins={users.filter((u) => u.companyId === c.id && u.role === 'admin')}
              reload={reload}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function CompanyRow({ company, admins, reload }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [invitation, setInvitation] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function remove() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await deleteCompany(company.id)
      await reload()
    } catch (err) {
      setError(err.message)
      setBusy(false)
      setConfirmDelete(false)
    }
    // succès : la ligne disparaît au reload, pas de setState post-suppression.
  }

  async function invite(e) {
    e.preventDefault()
    const value = email.trim()
    if (!value || busy) return
    setError(null)
    setBusy(true)
    try {
      const res = await inviteAdmin(company.id, value)
      setInvitation(res?.invitation ?? null)
      setEmail('')
      // Resynchronise la liste : le nouvel admin apparaît sous l'entreprise
      // (et dans l'onglet Utilisateurs).
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="admin-row admin-row-col">
      <div className="admin-row-main">
        <span className="admin-row-title">
          <Buildings size={16} weight="fill" />
          {company.name}
        </span>
        <code className="admin-id">{company.id}</code>
        {admins.length > 0 && (
          <span className="admin-row-admins">
            {admins.map((a) => (
              <span
                key={a.id ?? a.username}
                className="badge badge-accent"
                title="Administrateur"
              >
                <EnvelopeSimple size={12} weight="bold" />
                {a.email ?? a.username}
              </span>
            ))}
          </span>
        )}
        <span className="admin-row-spacer" />
        {confirmDelete ? (
          <span className="admin-confirm">
            <span className="admin-confirm-label">Supprimer et tout son contenu ?</span>
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
            className="btn btn-ghost admin-danger-btn"
            onClick={() => setConfirmDelete(true)}
            title="Supprimer l'entreprise"
          >
            <Trash size={15} weight="bold" />
            Supprimer
          </button>
        )}
      </div>

      <form className="admin-inline-form" onSubmit={invite}>
        <div className="input-wrap admin-grow">
          <EnvelopeSimple className="input-icon" size={16} weight="bold" />
          <input
            className="has-icon"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email de l'administrateur"
            aria-label={`Inviter un administrateur pour ${company.name}`}
          />
        </div>
        <button className="btn btn-ghost" type="submit" disabled={!email.trim() || busy}>
          {busy ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <PaperPlaneTilt size={15} weight="bold" />
          )}
          Inviter
        </button>
      </form>

      {error && (
        <div className="error-text" role="alert">
          <Warning size={15} weight="fill" />
          {error}
        </div>
      )}

      {invitation && <InvitationBox invitation={invitation} />}
    </li>
  )
}

function InvitationBox({ invitation }) {
  return (
    <div className="invite-box">
      <span className="invite-box-head">
        <Check size={15} weight="bold" />
        Invitation créée pour {invitation.email}
      </span>
      <p className="invite-box-note">
        Le mot de passe temporaire est valable 24 h. Transmettez ces informations si
        l'email n'est pas configuré.
      </p>
      <CopyRow label="Lien de connexion" value={invitation.link} />
      <CopyRow label="Mot de passe temporaire" value={invitation.tempPassword} mono />
    </div>
  )
}

function CopyRow({ label, value, mono }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* presse-papiers indisponible : l'utilisateur peut sélectionner le texte */
    }
  }

  return (
    <div className="copy-row">
      <span className="copy-row-label">{label}</span>
      <code className={`copy-row-value ${mono ? 'tnum' : ''}`}>{value}</code>
      <button
        type="button"
        className="btn-icon"
        onClick={copy}
        title="Copier"
        aria-label={`Copier : ${label}`}
      >
        {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
      </button>
    </div>
  )
}
