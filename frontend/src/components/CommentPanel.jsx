import { useMemo, useState } from 'react'
import {
  ChatCircleDots,
  CheckCircle,
  PencilSimple,
  Trash,
  PaperPlaneTilt,
  Broadcast,
  X,
} from '@phosphor-icons/react'
import { formatTime, initials } from '../lib/format'

// Panneau latéral : liste des commentaires (triés par temps) + compositeur.
export default function CommentPanel({
  notes,
  activeId,
  onSelect,
  onEdit,
  onReply,
  onResolve,
  onDelete,
  canDelete,
  currentUser,
  peerCount,
  // compositeur
  composeTime,
  draftCount,
  text,
  isEditing,
  onText,
  onSubmit,
  onClearDraft,
}) {
  const [authorFilter, setAuthorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [mineOnly, setMineOnly] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState({})

  const canSubmit = text.trim().length > 0 || draftCount > 0
  const authors = useMemo(() => {
    const byId = new Map()
    for (const note of notes) byId.set(note.author.id, note.author)
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [notes])
  const filteredNotes = useMemo(
    () =>
      notes.filter((note) => {
        if (authorFilter !== 'all' && note.author.id !== authorFilter) return false
        if (statusFilter === 'open' && note.resolved) return false
        if (statusFilter === 'resolved' && !note.resolved) return false
        if (mineOnly && note.author.id !== currentUser.id) return false
        return true
      }),
    [authorFilter, currentUser.id, mineOnly, notes, statusFilter],
  )

  function submitReply(note) {
    const value = (replyDrafts[note.id] || '').trim()
    if (!value) return
    onReply(note.id, value)
    setReplyDrafts((drafts) => ({ ...drafts, [note.id]: '' }))
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h3>
          Commentaires <span className="count">· {notes.length}</span>
        </h3>
        <span className="badge badge-accent" title="Participants connectés en direct">
          <Broadcast size={13} weight="fill" />
          {peerCount + 1} en ligne
        </span>
      </div>

      <div className="comment-filters" aria-label="Filtres des commentaires">
        <select
          value={authorFilter}
          aria-label="Filtrer par auteur"
          onChange={(e) => setAuthorFilter(e.target.value)}
        >
          <option value="all">Tous les auteurs</option>
          {authors.map((author) => (
            <option key={author.id} value={author.id}>
              {author.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          aria-label="Filtrer par état"
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tous les états</option>
          <option value="open">Ouverts</option>
          <option value="resolved">Résolus</option>
        </select>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
          />
          Mes commentaires
        </label>
      </div>

      {notes.length === 0 ? (
        <div className="empty">
          <ChatCircleDots size={40} weight="light" />
          <p>
            Aucune note. Mettez en pause, dessinez sur l'image ou écrivez un commentaire
            pour épingler un retour au timecode.
          </p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="empty">
          <ChatCircleDots size={36} weight="light" />
          <p>Aucun commentaire ne correspond aux filtres.</p>
        </div>
      ) : (
        <div className="comment-list">
          {filteredNotes.map((n) => (
            <div
              key={n.id}
              className={`comment${n.id === activeId ? ' active' : ''}${n.resolved ? ' resolved' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(n)
                }
              }}
            >
              <span className="avatar" style={{ background: n.author.color }}>
                {initials(n.author.name)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="comment-head">
                  <span className="comment-author">{n.author.name}</span>
                  <span className="comment-time">{formatTime(n.time)}</span>
                  <button
                    className={`resolve-btn${n.resolved ? ' active' : ''}`}
                    title={n.resolved ? 'Marquer non résolu' : 'Marquer résolu'}
                    aria-label={n.resolved ? 'Marquer non résolu' : 'Marquer résolu'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onResolve(n.id, !n.resolved)
                    }}
                  >
                    <CheckCircle size={14} weight={n.resolved ? 'fill' : 'regular'} />
                    {n.resolved ? 'Résolu' : 'Ouvert'}
                  </button>
                  <button
                    className="btn-icon"
                    style={{ width: 24, height: 24, marginLeft: 'auto' }}
                    title="Modifier"
                    aria-label="Modifier le commentaire"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(n)
                    }}
                  >
                    <PencilSimple size={14} />
                  </button>
                  {canDelete(n) && (
                    <button
                      className="btn-icon"
                      style={{ width: 24, height: 24 }}
                      title="Supprimer"
                      aria-label="Supprimer le commentaire"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(n)
                      }}
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
                {n.text && <div className="comment-body">{n.text}</div>}
                {n.shapes?.length > 0 && (
                  <div
                    className="comment-tags"
                    title={`${n.shapes.length} annotation(s)`}
                  >
                    {n.shapes.slice(0, 6).map((s, i) => (
                      <span
                        key={i}
                        className="comment-tag"
                        style={{ background: s.color }}
                      />
                    ))}
                  </div>
                )}
                {n.replies?.length > 0 && (
                  <div className="reply-list">
                    {n.replies.map((reply) => (
                      <div key={reply.id} className="reply">
                        <span
                          className="reply-dot"
                          style={{ background: reply.author.color }}
                        />
                        <div>
                          <div className="reply-head">
                            <span>{reply.author.name}</span>
                            <span>
                              {new Date(reply.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="reply-body">{reply.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className="reply-form"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    value={replyDrafts[n.id] || ''}
                    placeholder="Répondre…"
                    aria-label={`Répondre à ${n.author.name}`}
                    onChange={(e) =>
                      setReplyDrafts((drafts) => ({
                        ...drafts,
                        [n.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        submitReply(n)
                      }
                    }}
                  />
                  <button
                    className="btn-icon"
                    title="Envoyer la réponse"
                    aria-label="Envoyer la réponse"
                    disabled={!(replyDrafts[n.id] || '').trim()}
                    onClick={() => submitReply(n)}
                  >
                    <PaperPlaneTilt size={14} weight="fill" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="composer">
        <div className="composer-at">
          {isEditing ? 'Modification à ' : 'Note à '}
          <b>{formatTime(composeTime)}</b>
          {draftCount > 0 && (
            <>
              <span>·</span>
              <span style={{ color: 'var(--accent-strong)' }}>
                {draftCount} annotation{draftCount > 1 ? 's' : ''}
              </span>
              <button
                className="btn-icon"
                style={{ width: 22, height: 22 }}
                title="Effacer le brouillon de dessin"
                aria-label="Effacer le brouillon"
                onClick={onClearDraft}
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
        <textarea
          placeholder="Écrire un commentaire à cet instant…"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
              e.preventDefault()
              onSubmit()
            }
          }}
        />
        <div className="composer-actions">
          <button className="btn btn-primary" onClick={onSubmit} disabled={!canSubmit}>
            <PaperPlaneTilt size={15} weight="fill" />
            {isEditing ? 'Enregistrer' : 'Commenter'}
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>⌘/Ctrl + ↵</span>
        </div>
      </div>
    </aside>
  )
}
