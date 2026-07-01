import { useMemo, useState } from 'react'
import {
  ChatCircleDots,
  CheckCircle,
  PencilSimple,
  Trash,
  PaperPlaneTilt,
  Broadcast,
  X,
  ThumbsUp,
  ArrowBendDownLeft,
} from '@phosphor-icons/react'
import { formatTime, timeAgo, initials } from '../lib/format'

// Panneau latéral : liste des commentaires (triés par temps) + compositeur.
export default function CommentPanel({
  user,
  notes,
  activeId,
  onSelect,
  onEdit,
  onResolve,
  onDelete,
  canDelete,
  onToggleLike,
  onAddReply,
  onDeleteReply,
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

  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')

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
        if (mineOnly && note.author.id !== user.id) return false
        return true
      }),
    [authorFilter, user.id, mineOnly, notes, statusFilter],
  )

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
        <div className="filter-status-group">
          {['all', 'open', 'resolved'].map((s) => (
            <button
              key={s}
              className={`filter-status-btn${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Tous' : s === 'open' ? 'Ouverts' : 'Résolus'}
            </button>
          ))}
        </div>
        <label className={`filter-chip${mineOnly ? ' active' : ''}`}>
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
          {filteredNotes.map((n) => {
            const likes = n.likes || []
            const replies = n.replies || []
            const liked = likes.some((l) => l.id === user.id)
            return (
              <div key={n.id} className={`comment-wrap${n.resolved ? ' resolved' : ''}`}>
                <div
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
                      <span className="comment-ago">
                        {n.createdAt ? timeAgo(n.createdAt) : ''}
                      </span>
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
                    <div className="comment-actions">
                      <button
                        className={`comment-btn${liked ? ' liked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleLike(n.id)
                        }}
                        title={liked ? 'Retirer le like' : "J'aime"}
                      >
                        <ThumbsUp size={13} weight={liked ? 'fill' : 'regular'} />
                        {likes.length > 0 && <span>{likes.length}</span>}
                      </button>
                      <button
                        className="comment-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setReplyTo(replyTo === n.id ? null : n.id)
                          setReplyText('')
                        }}
                        title="Répondre"
                      >
                        <ArrowBendDownLeft size={13} />
                        {replies.length > 0 && <span>{replies.length}</span>}
                      </button>
                    </div>
                    {replies.length > 0 && (
                      <div className="comment-replies">
                        {replies.map((r) => (
                          <div key={r.id} className="reply">
                            <span
                              className="avatar"
                              style={{
                                background: r.author.color,
                                width: 20,
                                height: 20,
                                fontSize: 9,
                              }}
                            >
                              {initials(r.author.name)}
                            </span>
                            <div>
                              <div className="reply-head">
                                <span className="reply-author">{r.author.name}</span>
                                <span className="reply-ago">{timeAgo(r.createdAt)}</span>
                                {(r.author.id === user.id || user.role === 'admin') && (
                                  <button
                                    className="btn-icon"
                                    style={{ width: 18, height: 18, marginLeft: 'auto' }}
                                    title="Supprimer"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onDeleteReply(n.id, r.id)
                                    }}
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </div>
                              <div className="reply-body">{r.text}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {replyTo === n.id && (
                      <div
                        className="reply-composer"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <textarea
                          placeholder="Écrire une réponse…"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (
                              (e.metaKey || e.ctrlKey) &&
                              e.key === 'Enter' &&
                              replyText.trim()
                            ) {
                              e.preventDefault()
                              onAddReply(n.id, replyText)
                              setReplyText('')
                              setReplyTo(null)
                            }
                          }}
                          rows={2}
                        />
                        <div className="reply-composer-actions">
                          <button
                            className="btn btn-primary"
                            style={{ height: 30, fontSize: 12 }}
                            disabled={!replyText.trim()}
                            onClick={() => {
                              onAddReply(n.id, replyText)
                              setReplyText('')
                              setReplyTo(null)
                            }}
                          >
                            Répondre
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ height: 30, fontSize: 12 }}
                            onClick={() => {
                              setReplyTo(null)
                              setReplyText('')
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
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
