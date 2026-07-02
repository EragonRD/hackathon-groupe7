import { useEffect, useMemo, useRef, useState } from 'react'
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
import { getMetadata, requestAnalysis, translateContent } from '../contents'
import { formatTime } from '../lib/format'

// Langues proposées pour la traduction à la demande (test temps réel).
const TARGET_LANGS = [
  ['en', 'Anglais'],
  ['es', 'Espagnol'],
  ['ar', 'Arabe'],
  ['de', 'Allemand'],
  ['it', 'Italien'],
  ['pt', 'Portugais'],
  ['zh', 'Chinois'],
  ['ja', 'Japonais'],
  ['ru', 'Russe'],
]

// Insights IA (Pôle 3) affichés SOUS le player (Bloc B, P1<->P3).
// Résumé + chapitres + transcription cliquables (saut au timecode), mots-clés,
// traduction. Se met à jour tout seul quand l'analyse passe de "processing" à
// "done" (le hook re-poll le Core).
export default function InsightsPanel({
  contentId,
  onSeek,
  currentTime = 0,
  meta: metaProp,
}) {
  // Si le parent fournit déjà `meta` (VideoReview, pour partager avec les
  // sous-titres), on l'utilise et on n'ouvre PAS un second polling.
  const ownMeta = useMetadata(metaProp ? null : contentId)
  // Après un lancement manuel d'analyse, un polling LOCAL prend le relais (le hook
  // useMetadata ne re-poll pas depuis un état 'not_analyzed'/'error'). localMeta,
  // s'il existe, prime sur la source normale.
  const [localMeta, setLocalMeta] = useState(null)
  const [launching, setLaunching] = useState(false)
  const [launchErr, setLaunchErr] = useState(null)
  const [trackedId, setTrackedId] = useState(contentId)
  const pollRef = useRef(null)
  const meta = localMeta ?? metaProp ?? ownMeta
  const [open, setOpen] = useState(false)

  // Reset du suivi local au changement de contenu — PENDANT le rendu (pattern
  // React sanctionné), pas dans un effet (setState synchrone en effet = interdit).
  if (trackedId !== contentId) {
    setTrackedId(contentId)
    setLocalMeta(null)
    setLaunchErr(null)
  }

  // Nettoyage du timer de polling local (démontage / changement de contenu).
  useEffect(() => () => clearTimeout(pollRef.current), [contentId])

  const startLocalPoll = () => {
    clearTimeout(pollRef.current)
    const tick = async () => {
      try {
        const r = await getMetadata(contentId)
        setLocalMeta(r)
        if (r.status === 'processing') pollRef.current = setTimeout(tick, 4000)
      } catch (e) {
        setLocalMeta({ status: 'error', error: e.message })
      }
    }
    pollRef.current = setTimeout(tick, 4000)
  }

  const runAnalyze = async () => {
    if (!contentId || launching) return
    setLaunching(true)
    setLaunchErr(null)
    try {
      const r = await requestAnalysis(contentId)
      setLocalMeta({ status: r.status === 'done' ? 'done' : 'processing' })
      if (r.status !== 'done') startLocalPoll()
    } catch (e) {
      setLaunchErr(e.message)
    } finally {
      setLaunching(false)
    }
  }
  const [query, setQuery] = useState('')
  // Traduction à la demande (test temps réel).
  const [transLang, setTransLang] = useState('en')
  const [transBusy, setTransBusy] = useState(false)
  const [transErr, setTransErr] = useState(null)
  const [liveTrack, setLiveTrack] = useState(null)

  const runTranslate = async () => {
    if (!contentId || transBusy) return
    setTransBusy(true)
    setTransErr(null)
    setLiveTrack(null)
    try {
      setLiveTrack(await translateContent(contentId, transLang))
    } catch (e) {
      setTransErr(e.message)
    } finally {
      setTransBusy(false)
    }
  }

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
          ? meta.error?.includes('hors ligne')
            ? 'Hors ligne'
            : 'Indisponible'
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
            <div className="insights-block">
              <p className="insights-error">
                <strong>Analyse IA indisponible</strong>
              </p>
              <p className="insights-muted">{meta.error}</p>
            </div>
          )}

          {/* Lancer / relancer l'analyse pour une vidéo déjà uploadée (jamais
              analysée, ou en erreur). Le Core reconstruit l'audio depuis le HLS. */}
          {(meta.status === 'not_analyzed' || meta.status === 'error') && (
            <div className="insights-block">
              <button
                type="button"
                className="btn btn-primary insights-analyze"
                onClick={runAnalyze}
                disabled={launching}
              >
                {launching ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <Sparkle size={15} weight="fill" />
                )}
                {meta.status === 'error'
                  ? "Relancer l'analyse IA"
                  : "Lancer l'analyse IA"}
              </button>
              {launchErr && <p className="insights-error">{launchErr}</p>}
            </div>
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

              {/* Traduction : à la demande (temps réel) + pistes pré-calculées */}
              {segments.length > 0 && (
                <div className="insights-block">
                  <h4 className="insights-h">
                    <Translate size={13} weight="bold" /> Traduction
                  </h4>

                  <div className="insights-translate-bar">
                    <select
                      className="insights-select"
                      value={transLang}
                      onChange={(e) => setTransLang(e.target.value)}
                      disabled={transBusy}
                    >
                      {TARGET_LANGS.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="insights-translate-btn"
                      onClick={runTranslate}
                      disabled={transBusy}
                    >
                      {transBusy ? 'Traduction…' : 'Traduire'}
                    </button>
                  </div>

                  {transErr && <p className="insights-error">{transErr}</p>}

                  {liveTrack && (
                    <ul className="insights-transcript">
                      {liveTrack.segments.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className="insights-seg"
                            onClick={() => onSeek?.(s.start)}
                          >
                            <span className="insights-tc">
                              {formatTime(s.start ?? 0)}
                            </span>
                            <span className="insights-seg-text">{s.text}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

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
