import {
  ChatCircleDots,
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
  onDelete,
  canDelete,
  peerCount,
  // compositeur
  composeTime,
  draftCount,
  text,
  onText,
  onSubmit,
  onClearDraft,
}) {
  const canSubmit = text.trim().length > 0 || draftCount > 0

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

      {notes.length === 0 ? (
        <div className="empty">
          <ChatCircleDots size={40} weight="light" />
          <p>
            Aucune note. Mettez en pause, dessinez sur l'image ou écrivez un commentaire
            pour épingler un retour au timecode.
          </p>
        </div>
      ) : (
        <div className="comment-list">
          {notes.map((n) => (
            <div
              key={n.id}
              className={`comment${n.id === activeId ? ' active' : ''}`}
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
                  {canDelete(n) && (
                    <button
                      className="btn-icon"
                      style={{ width: 24, height: 24, marginLeft: 'auto' }}
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
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="composer">
        <div className="composer-at">
          Note à <b>{formatTime(composeTime)}</b>
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
            Commenter
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>⌘/Ctrl + ↵</span>
        </div>
      </div>
    </aside>
  )
}
