import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createTransport } from './collab'
import { colorForUser, shortId } from './format'
import { fetchNotes, saveNotes } from './notes'

// ============================================================================
//  useReview — état d'une session de revue, synchronisé entre participants.
// ----------------------------------------------------------------------------
//  Une "note" rattache un commentaire ET des dessins à un timecode précis :
//    {
//      id, time,                 // instant dans la vidéo (secondes)
//      author: { id, name, color },
//      text,                     // commentaire (peut être vide si dessin seul)
//      shapes: [ { tool, color, points|rect, ... } ],
//      createdAt                 // ISO
//    }
//
//  Synchro : chaque mutation locale est diffusée via le transport (collab.js).
//  Persistance : miroir local (localStorage) pour survivre à un rechargement
//  et amorcer une fenêtre qui rejoint sans pair actif.
//
//  "Watch Together" (sujet B) : le présentateur pilote la lecture, les invités
//  suivent. Tout passe par le même bus (messages `wt:*`). Le présentateur est
//  REVENDIQUÉ manuellement (claimPresenter) -> pas d'élection raciste. Anti-écho
//  et resync du retardataire gérés ici + dans VideoReview.
// ============================================================================

const PRESENCE_PING_MS = 3000
const PRESENCE_TIMEOUT_MS = 9000

function storageKey(session) {
  return `review:notes:${session}`
}

function loadNotes(session) {
  try {
    const raw = localStorage.getItem(storageKey(session))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useReview({ session, user, mode }) {
  const self = useMemo(
    () => ({
      id: String(user?.id ?? user?.username ?? shortId()),
      name: user?.username ?? 'invité',
      role: user?.role ?? 'member',
      color: colorForUser(user?.id ?? user?.username ?? 'invité'),
    }),
    [user],
  )

  const [notes, setNotes] = useState(() => loadNotes(session))
  const [peers, setPeers] = useState({}) // id -> { id, name, color, lastSeen, cursor }
  const [presenterId, setPresenterId] = useState(null) // id du présentateur (Watch Together)
  const transportRef = useRef(null)
  // Persistance serveur (notes.js) : `loadedRef` passe à true après le 1er fetch
  // RÉUSSI (anti-clobber : on ne sauvegarde pas tant qu'on n'a pas lu le serveur) ;
  // `saveTimerRef` debounce les écritures.
  const loadedRef = useRef(false)
  const saveTimerRef = useRef(null)
  // Références "toujours fraîches" pour l'effet de connexion (handlers async) :
  // elles évitent de remettre `self`/`notes` en dépendances de la (re)connexion.
  // Mises à jour dans des effets (jamais pendant le render).
  const selfRef = useRef(self)
  const notesRef = useRef(notes)
  const presenterIdRef = useRef(presenterId)
  // Dernier état de lecture connu du présentateur (pour répondre aux retardataires).
  const lastPlaybackRef = useRef(null)
  // Abonnés aux commandes de lecture distantes (VideoReview s'y branche).
  const playbackListenersRef = useRef(new Set())
  useEffect(() => {
    selfRef.current = self
  }, [self])
  useEffect(() => {
    notesRef.current = notes
  }, [notes])
  useEffect(() => {
    presenterIdRef.current = presenterId
  }, [presenterId])

  const emitPlayback = useCallback((evt) => {
    for (const fn of playbackListenersRef.current) fn(evt)
  }, [])

  // --- Miroir localStorage à chaque changement de notes -------------------
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(session), JSON.stringify(notes))
    } catch {
      /* quota/private mode : on ignore, la synchro live reste la source */
    }
  }, [notes, session])

  // --- Helpers d'agrégation (dédupe par id) -------------------------------
  const upsertNotes = useCallback((incoming) => {
    setNotes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]))
      for (const n of incoming) byId.set(n.id, n)
      return [...byId.values()].sort((a, b) => a.time - b.time)
    })
  }, [])

  // --- Chargement initial depuis le serveur (source partagée, durable) -------
  // Complète le temps réel : les notes survivent au départ de tous les pairs et
  // reviennent à l'ouverture, sur n'importe quelle machine. Best-effort.
  useEffect(() => {
    let alive = true
    loadedRef.current = false
    fetchNotes(session).then((serverNotes) => {
      if (!alive) return
      if (serverNotes) {
        if (serverNotes.length) upsertNotes(serverNotes)
        loadedRef.current = true // fetch OK -> on autorise la sauvegarde (même si vide)
      }
      // fetch KO (null) -> loadedRef reste false : on NE sauvegarde pas (anti-clobber).
    })
    return () => {
      alive = false
    }
  }, [session, upsertNotes])

  // --- Sauvegarde serveur debouncée à chaque changement de notes -------------
  useEffect(() => {
    if (!loadedRef.current) return undefined
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveNotes(session, notesRef.current)
    }, 800)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [notes, session])

  // --- Connexion au transport + boucle de présence ------------------------
  useEffect(() => {
    const t = createTransport(session, { mode })
    transportRef.current = t

    const touchPeer = (p, extra = {}) => {
      if (!p || p.id === selfRef.current.id) return
      setPeers((prev) => ({
        ...prev,
        [p.id]: { ...prev[p.id], ...p, ...extra, lastSeen: Date.now() },
      }))
    }

    const off = t.subscribe((msg) => {
      if (!msg || msg.from === selfRef.current.id) return
      switch (msg.type) {
        case 'join':
          touchPeer(msg.payload)
          // On se présente au nouveau venu + on lui envoie l'état courant.
          t.post({ type: 'presence', from: selfRef.current.id, payload: selfRef.current })
          t.post({
            type: 'sync:state',
            from: selfRef.current.id,
            payload: { notes: notesRef.current },
          })
          // Si JE présente, je resynchronise le retardataire sur la lecture.
          if (presenterIdRef.current === selfRef.current.id) {
            t.post({
              type: 'wt:state',
              from: selfRef.current.id,
              payload: {
                presenterId: selfRef.current.id,
                playback: lastPlaybackRef.current,
              },
            })
          }
          break
        case 'presence':
          touchPeer(msg.payload)
          break
        case 'leave':
          setPeers((prev) => {
            const next = { ...prev }
            delete next[msg.from]
            return next
          })
          // Le présentateur est parti -> plus personne ne pilote.
          if (presenterIdRef.current === msg.from) setPresenterId(null)
          break
        case 'cursor':
          touchPeer({ id: msg.from }, { cursor: msg.payload })
          break
        case 'note:add':
          upsertNotes([msg.payload])
          break
        case 'note:reply':
          upsertNotes([msg.payload])
          break
        case 'note:resolve':
          upsertNotes([msg.payload])
          break
        case 'note:remove':
          setNotes((prev) => prev.filter((n) => n.id !== msg.payload.id))
          break
        case 'note:like':
          setNotes((prev) =>
            prev.map((n) =>
              n.id === msg.payload.id ? { ...n, likes: msg.payload.likes } : n,
            ),
          )
          break
        case 'note:update':
          setNotes((prev) =>
            prev.map((n) =>
              n.id === msg.payload.id ? { ...n, shapes: msg.payload.shapes } : n,
            ),
          )
          break
        case 'sync:state':
          upsertNotes(msg.payload.notes || [])
          break
        // --- Watch Together ------------------------------------------------
        case 'wt:claim':
          // Quelqu'un prend la présentation : il devient le présentateur unique.
          setPresenterId(msg.from)
          break
        case 'wt:release':
          if (presenterIdRef.current === msg.from) setPresenterId(null)
          break
        case 'wt:state':
          // Réponse de resync reçue par un retardataire.
          setPresenterId(msg.payload?.presenterId ?? null)
          if (msg.payload?.playback) {
            emitPlayback({ kind: 'state', ...msg.payload.playback })
          }
          break
        case 'wt:playback':
          // On n'applique QUE les commandes du présentateur courant (anti-usurpation).
          if (msg.from === presenterIdRef.current) {
            emitPlayback({ kind: 'playback', ...msg.payload })
          }
          break
        case 'wt:heartbeat':
          if (msg.from === presenterIdRef.current) {
            emitPlayback({ kind: 'heartbeat', ...msg.payload })
          }
          break
        case 'wt:rate':
          // Vitesse de lecture imposée par le présentateur.
          if (msg.from === presenterIdRef.current) {
            emitPlayback({ kind: 'rate', rate: msg.payload?.rate })
          }
          break
        default:
          break
      }
    })

    t.post({ type: 'join', from: self.id, payload: self })

    const ping = setInterval(() => {
      t.post({ type: 'presence', from: selfRef.current.id, payload: selfRef.current })
    }, PRESENCE_PING_MS)

    // Purge des pairs silencieux (fermeture brutale d'onglet, etc.)
    const prune = setInterval(() => {
      const cutoff = Date.now() - PRESENCE_TIMEOUT_MS
      setPeers((prev) => {
        let changed = false
        const next = {}
        for (const [id, p] of Object.entries(prev)) {
          if (p.lastSeen >= cutoff) next[id] = p
          else changed = true
        }
        // Présentateur disparu sans `leave` (crash onglet) -> on libère la main.
        if (
          presenterIdRef.current &&
          presenterIdRef.current !== selfRef.current.id &&
          !next[presenterIdRef.current]
        ) {
          setPresenterId(null)
        }
        return changed ? next : prev
      })
    }, 2000)

    const onUnload = () => t.post({ type: 'leave', from: selfRef.current.id })
    window.addEventListener('beforeunload', onUnload)

    return () => {
      onUnload()
      off()
      clearInterval(ping)
      clearInterval(prune)
      window.removeEventListener('beforeunload', onUnload)
      t.close()
    }
    // session/mode/self.id pilotent la (re)connexion ; notes lues via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mode, self.id])

  // --- API publique : notes ----------------------------------------------
  const addNote = useCallback(
    ({ time, text, shapes, color }) => {
      const note = {
        id: shortId(),
        time,
        author: { id: self.id, name: self.name, color: self.color },
        text: (text || '').trim(),
        shapes: shapes || [],
        color: color || self.color,
        replies: [],
        resolved: false,
        createdAt: new Date().toISOString(),
      }
      upsertNotes([note])
      transportRef.current?.post({ type: 'note:add', from: self.id, payload: note })
      return note
    },
    [self, upsertNotes],
  )

  const removeNote = useCallback(
    (id) => {
      setNotes((prev) => prev.filter((n) => n.id !== id))
      transportRef.current?.post({ type: 'note:remove', from: self.id, payload: { id } })
    },
    [self.id],
  )

  const updateNote = useCallback(
    (id, patch) => {
      const current = notesRef.current.find((n) => n.id === id)
      if (!current) return null
      const note = {
        ...current,
        ...patch,
        id: current.id,
        author: current.author,
        updatedAt: new Date().toISOString(),
      }
      upsertNotes([note])
      transportRef.current?.post({ type: 'note:add', from: self.id, payload: note })
      return note
    },
    [self.id, upsertNotes],
  )

  const replyToNote = useCallback(
    (id, text) => {
      const value = (text || '').trim()
      if (!value) return null
      const current = notesRef.current.find((n) => n.id === id)
      if (!current) return null
      const note = {
        ...current,
        replies: [
          ...(current.replies || []),
          {
            id: shortId(),
            author: { id: self.id, name: self.name, color: self.color },
            text: value,
            createdAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      }
      upsertNotes([note])
      transportRef.current?.post({ type: 'note:reply', from: self.id, payload: note })
      return note
    },
    [self, upsertNotes],
  )

  const resolveNote = useCallback(
    (id, resolved) => {
      const current = notesRef.current.find((n) => n.id === id)
      if (!current) return null
      const note = {
        ...current,
        resolved: Boolean(resolved),
        updatedAt: new Date().toISOString(),
      }
      upsertNotes([note])
      transportRef.current?.post({ type: 'note:resolve', from: self.id, payload: note })
      return note
    },
    [self.id, upsertNotes],
  )

  const toggleLike = useCallback(
    (noteId) => {
      setNotes((prev) => {
        const note = prev.find((n) => n.id === noteId)
        if (!note) return prev
        const likes = note.likes || []
        const idx = likes.findIndex((l) => l.id === self.id)
        const updated = {
          ...note,
          likes:
            idx >= 0
              ? likes.filter((l) => l.id !== self.id)
              : [...likes, { id: self.id, name: self.name }],
        }
        const result = prev.map((n) => (n.id === noteId ? updated : n))
        transportRef.current?.post({ type: 'note:like', from: self.id, payload: updated })
        return result
      })
    },
    [self],
  )

  const addReply = useCallback(
    (noteId, text) => {
      if (!text.trim()) return
      const reply = {
        id: shortId(),
        author: { id: self.id, name: self.name, color: self.color },
        text: text.trim(),
        createdAt: new Date().toISOString(),
      }
      setNotes((prev) => {
        const note = prev.find((n) => n.id === noteId)
        if (!note) return prev
        const updated = {
          ...note,
          replies: [...(note.replies || []), reply],
        }
        const result = prev.map((n) => (n.id === noteId ? updated : n))
        transportRef.current?.post({
          type: 'note:reply',
          from: self.id,
          payload: updated,
        })
        return result
      })
    },
    [self],
  )

  const deleteReply = useCallback(
    (noteId, replyId) => {
      setNotes((prev) => {
        const note = prev.find((n) => n.id === noteId)
        if (!note) return prev
        const updated = {
          ...note,
          replies: (note.replies || []).filter((r) => r.id !== replyId),
        }
        const result = prev.map((n) => (n.id === noteId ? updated : n))
        transportRef.current?.post({
          type: 'note:reply',
          from: self.id,
          payload: updated,
        })
        return result
      })
    },
    [self],
  )

  // Remplace les shapes d'une note (gomme, clear).
  const updateNoteShapes = useCallback(
    (noteId, shapes) => {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, shapes } : n)))
      transportRef.current?.post({
        type: 'note:update',
        from: self.id,
        payload: { id: noteId, shapes },
      })
    },
    [self.id],
  )

  // Remplace tout le jeu de notes (réimport JSON) + le diffuse.
  const replaceNotes = useCallback(
    (incoming) => {
      const clean = (incoming || [])
        .filter((n) => typeof n.time === 'number')
        .sort((a, b) => a.time - b.time)
      setNotes(clean)
      transportRef.current?.post({
        type: 'sync:state',
        from: self.id,
        payload: { notes: clean },
      })
    },
    [self.id],
  )

  // Position de curseur (normalisée 0..1), throttlée pour ne pas saturer.
  const lastCursorRef = useRef(0)
  const sendCursor = useCallback(
    (nx, ny) => {
      const now = Date.now()
      if (now - lastCursorRef.current < 55) return
      lastCursorRef.current = now
      transportRef.current?.post({
        type: 'cursor',
        from: self.id,
        payload: { x: nx, y: ny, name: self.name, color: self.color },
      })
    },
    [self],
  )

  // --- API publique : Watch Together -------------------------------------
  const claimPresenter = useCallback(() => {
    setPresenterId(self.id)
    transportRef.current?.post({ type: 'wt:claim', from: self.id })
  }, [self.id])

  const releasePresenter = useCallback(() => {
    setPresenterId(null)
    transportRef.current?.post({ type: 'wt:release', from: self.id })
  }, [self.id])

  // Commande de lecture émise par le présentateur (play/pause/seek).
  const sendPlayback = useCallback(
    ({ action, position }) => {
      lastPlaybackRef.current = {
        paused: action !== 'play',
        position,
        at: Date.now(),
      }
      transportRef.current?.post({
        type: 'wt:playback',
        from: self.id,
        payload: { action, position, at: Date.now() },
      })
    },
    [self.id],
  )

  // Battement régulier (anti-dérive) émis par le présentateur. Porte aussi la
  // vitesse de lecture pour la resynchroniser (retardataire / robustesse).
  const sendHeartbeat = useCallback(
    ({ position, paused, rate }) => {
      lastPlaybackRef.current = { paused, position, rate, at: Date.now() }
      transportRef.current?.post({
        type: 'wt:heartbeat',
        from: self.id,
        payload: { position, paused, rate, at: Date.now() },
      })
    },
    [self.id],
  )

  // Changement de vitesse de lecture par le présentateur (appliqué chez les invités).
  const sendRate = useCallback(
    (rate) => {
      lastPlaybackRef.current = { ...(lastPlaybackRef.current || {}), rate }
      transportRef.current?.post({ type: 'wt:rate', from: self.id, payload: { rate } })
    },
    [self.id],
  )

  // VideoReview s'abonne aux commandes distantes (play/pause/seek/state/heartbeat).
  const subscribePlayback = useCallback((fn) => {
    playbackListenersRef.current.add(fn)
    return () => playbackListenersRef.current.delete(fn)
  }, [])

  const peerList = useMemo(() => Object.values(peers), [peers])
  const isPresenter = presenterId === self.id

  return {
    self,
    notes,
    peers: peerList,
    addNote,
    updateNote,
    replyToNote,
    resolveNote,
    removeNote,
    updateNoteShapes,
    replaceNotes,
    sendCursor,
    toggleLike,
    addReply,
    deleteReply,
    presenterId,
    isPresenter,
    claimPresenter,
    releasePresenter,
    sendPlayback,
    sendHeartbeat,
    sendRate,
    subscribePlayback,
  }
}
