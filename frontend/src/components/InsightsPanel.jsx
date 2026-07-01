import { useMemo, useState } from 'react'
import {
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  Tag,
  Translate,
  ListBullets,
  Sparkle,
} from '@phosphor-icons/react'
import { useMetadata } from '../lib/useMetadata'
import { formatTime } from '../lib/format'

// Insights IA (Pôle 3) affichés SOUS le player (Bloc B, P1<->P3).
// Résumé + chapitres + transcription cliquables (saut au timecode), mots-clés,
// traduction. Se met à jour tout seul quand l'analyse passe de "processing" à
// "done" (le hook re-poll le Core).
export default function InsightsPanel({ contentId, onSeek, currentTime = 0 }) {
  const meta = useMetadata(contentId)
  const [open, setOpen] = useState(true)
  const [query, setQuery] = useState('')

  const data = meta.status === 'done' ? meta.data : null
  const segments = useMemo(() => data?.segments ?? [], [data])
  const chapters = data?.chapters ?? []
  const keywords = data?.keywords ?? []
  const translations = useMemo(() => {
    if (Array.isArray(data?.translations)) return data.translations
    if (data?.translation) return [data.translation]
    return []
  }, [data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return segments
    return segments.filter((s) => (s.text ?? '').toLowerCase().includes(q))
  }, [segments, query])

  // Statut compact affiché dans l'en-tête.
  const badge =
    meta.status === 'processing'
      ? 'Analyse en cours…'
      : meta.status === 'done'
        ? `${segments.length} segments`
        : meta.status === 'error'
          ? 'Erreur'
          : meta.status === 'loading'
            ? '…'
            : 'Aucune analyse'

  return (
    <section className={`insights${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="insights-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <CaretDown size={14} weight="bold" />
        ) : (
          <CaretRight size={14} weight="bold" />
        )}
        <Sparkle size={15} weight="fill" />
        <span className="insights-title">Insights IA</span>
        <span className="insights-badge">{badge}</span>
      </button>

      {open && (
        <div className="insights-body">
          {meta.status === 'loading' && <p className="insights-muted">Chargement…</p>}
          {meta.status === 'not_analyzed' && (
            <p className="insights-muted">Aucune analyse IA pour ce contenu.</p>
          )}
          {meta.status === 'processing' && (
            <p className="insights-muted">
              Analyse IA en cours (transcription, résumé, chapitres)… mise à jour
              automatique.
            </p>
          )}
          {meta.status === 'error' && (
            <p className="insights-muted insights-error">
              Analyse indisponible : {meta.error}
            </p>
          )}

          {data && (
            <>
              {/* Méta rapides */}
              <div className="insights-meta">
                {data.language && (
                  <span className="insights-chip">Langue : {data.language}</span>
                )}
                {typeof data.duration_sec === 'number' && (
                  <span className="insights-chip">
                    Durée : {formatTime(data.duration_sec)}
                  </span>
                )}
              </div>

              {/* Résumé */}
              {data.summary && (
                <div className="insights-block">
                  <h4 className="insights-h">Résumé</h4>
                  <p className="insights-summary">{data.summary}</p>
                </div>
              )}

              {/* Mots-clés */}
              {keywords.length > 0 && (
                <div className="insights-block">
                  <h4 className="insights-h">
                    <Tag size={13} weight="fill" /> Mots-clés
                  </h4>
                  <div className="insights-keywords">
                    {keywords.map((k, i) => (
                      <span key={i} className="insights-kw">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Chapitres cliquables */}
              {chapters.length > 0 && (
                <div className="insights-block">
                  <h4 className="insights-h">
                    <ListBullets size={13} weight="bold" /> Chapitres
                  </h4>
                  <ul className="insights-chapters">
                    {chapters.map((c, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="insights-jump"
                          onClick={() => onSeek?.(c.start)}
                        >
                          <span className="insights-tc">{formatTime(c.start ?? 0)}</span>
                          <span className="insights-chapter-title">{c.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Transcription cliquable + filtre */}
              {segments.length > 0 && (
                <div className="insights-block">
                  <h4 className="insights-h">Transcription</h4>
                  <div className="insights-search">
                    <MagnifyingGlass size={13} />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filtrer la transcription…"
                    />
                  </div>
                  <ul className="insights-transcript">
                    {filtered.map((s, i) => {
                      const active =
                        currentTime >= (s.start ?? 0) && currentTime < (s.end ?? Infinity)
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            className={`insights-seg${active ? ' is-active' : ''}`}
                            onClick={() => onSeek?.(s.start)}
                          >
                            <span className="insights-tc">
                              {formatTime(s.start ?? 0)}
                            </span>
                            <span className="insights-seg-text">{s.text}</span>
                          </button>
                        </li>
                      )
                    })}
                    {filtered.length === 0 && (
                      <li className="insights-muted">Aucun segment ne correspond.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Traduction(s) */}
              {translations.length > 0 && (
                <div className="insights-block">
                  <h4 className="insights-h">
                    <Translate size={13} weight="bold" /> Traduction
                  </h4>
                  {translations.map((t, i) => (
                    <details key={i} className="insights-translation">
                      <summary>{(t.lang ?? '??').toUpperCase()}</summary>
                      <p>{t.text}</p>
                    </details>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
