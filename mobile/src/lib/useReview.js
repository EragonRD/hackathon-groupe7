import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createTransport } from './collab';
import { colorForUser, shortId } from './format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const PRESENCE_PING_MS = 3000;
const PRESENCE_TIMEOUT_MS = 9000;

function storageKey(session) {
  return `review:notes:${session}`;
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
  );

  const [notes, setNotes] = useState([]);
  const [peers, setPeers] = useState({});
  const [presenterId, setPresenterId] = useState(null);
  
  const transportRef = useRef(null);
  const selfRef = useRef(self);
  const notesRef = useRef(notes);
  const presenterIdRef = useRef(presenterId);
  const lastPlaybackRef = useRef(null);
  const playbackListenersRef = useRef(new Set());

  useEffect(() => { selfRef.current = self; }, [self]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { presenterIdRef.current = presenterId; }, [presenterId]);

  const emitPlayback = useCallback((evt) => {
    for (const fn of playbackListenersRef.current) fn(evt);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(storageKey(session)).then(raw => {
      if (raw) {
        try {
          setNotes(JSON.parse(raw));
        } catch {
          // JSON corrompu en cache : on ignore, la synchro live reste la source
        }
      }
    });
  }, [session]);

  useEffect(() => {
    if (notes.length > 0) {
      AsyncStorage.setItem(storageKey(session), JSON.stringify(notes)).catch(() => {});
    }
  }, [notes, session]);

  const upsertNotes = useCallback((incoming) => {
    setNotes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      for (const n of incoming) byId.set(n.id, n);
      return [...byId.values()].sort((a, b) => a.time - b.time);
    });
  }, []);

  useEffect(() => {
    const t = createTransport(session, { mode });
    transportRef.current = t;

    const touchPeer = (p, extra = {}) => {
      if (!p || p.id === selfRef.current.id) return;
      setPeers((prev) => ({
        ...prev,
        [p.id]: { ...prev[p.id], ...p, ...extra, lastSeen: Date.now() },
      }));
    };

    const off = t.subscribe((msg) => {
      if (!msg || msg.from === selfRef.current.id) return;
      switch (msg.type) {
        case 'join':
          touchPeer(msg.payload);
          t.post({ type: 'presence', from: selfRef.current.id, payload: selfRef.current });
          t.post({
            type: 'sync:state',
            from: selfRef.current.id,
            payload: { notes: notesRef.current },
          });
          if (presenterIdRef.current === selfRef.current.id) {
            t.post({
              type: 'wt:state',
              from: selfRef.current.id,
              payload: {
                presenterId: selfRef.current.id,
                playback: lastPlaybackRef.current,
              },
            });
          }
          break;
        case 'presence':
          touchPeer(msg.payload);
          break;
        case 'leave':
          setPeers((prev) => {
            const next = { ...prev };
            delete next[msg.from];
            return next;
          });
          if (presenterIdRef.current === msg.from) setPresenterId(null);
          break;
        case 'cursor':
          touchPeer({ id: msg.from }, { cursor: msg.payload });
          break;
        case 'note:add':
        case 'note:reply':
        case 'note:resolve':
          upsertNotes([msg.payload]);
          break;
        case 'note:remove':
          setNotes((prev) => prev.filter((n) => n.id !== msg.payload.id));
          break;
        case 'note:like':
          setNotes((prev) =>
            prev.map((n) =>
              n.id === msg.payload.id ? { ...n, likes: msg.payload.likes } : n,
            ),
          );
          break;
        case 'note:update':
          setNotes((prev) =>
            prev.map((n) =>
              n.id === msg.payload.id ? { ...n, shapes: msg.payload.shapes } : n,
            ),
          );
          break;
        case 'sync:state':
          upsertNotes(msg.payload.notes || []);
          break;
        case 'wt:claim':
          setPresenterId(msg.from);
          break;
        case 'wt:release':
          if (presenterIdRef.current === msg.from) setPresenterId(null);
          break;
        case 'wt:state':
          setPresenterId(msg.payload?.presenterId ?? null);
          if (msg.payload?.playback) {
            emitPlayback({ kind: 'state', ...msg.payload.playback });
          }
          break;
        case 'wt:playback':
          if (msg.from === presenterIdRef.current) {
            emitPlayback({ kind: 'playback', ...msg.payload });
          }
          break;
        case 'wt:heartbeat':
          if (msg.from === presenterIdRef.current) {
            emitPlayback({ kind: 'heartbeat', ...msg.payload });
          }
          break;
        default:
          break;
      }
    });

    t.post({ type: 'join', from: self.id, payload: self });

    const ping = setInterval(() => {
      t.post({ type: 'presence', from: selfRef.current.id, payload: selfRef.current });
    }, PRESENCE_PING_MS);

    const prune = setInterval(() => {
      const cutoff = Date.now() - PRESENCE_TIMEOUT_MS;
      setPeers((prev) => {
        let changed = false;
        const next = {};
        for (const [id, p] of Object.entries(prev)) {
          if (p.lastSeen >= cutoff) next[id] = p;
          else changed = true;
        }
        if (
          presenterIdRef.current &&
          presenterIdRef.current !== selfRef.current.id &&
          !next[presenterIdRef.current]
        ) {
          setPresenterId(null);
        }
        return changed ? next : prev;
      });
    }, 2000);

    const onUnload = () => t.post({ type: 'leave', from: selfRef.current.id });
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState.match(/inactive|background/)) {
        onUnload();
      }
    });

    return () => {
      onUnload();
      off();
      clearInterval(ping);
      clearInterval(prune);
      subscription.remove();
      t.close();
    };
    // self/notes lus via refs "toujours fraîches" ; seuls session/mode/self.id
    // doivent (re)connecter le transport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mode, self.id]);

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
      };
      upsertNotes([note]);
      transportRef.current?.post({ type: 'note:add', from: self.id, payload: note });
      return note;
    },
    [self, upsertNotes],
  );

  const removeNote = useCallback(
    (id) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      transportRef.current?.post({ type: 'note:remove', from: self.id, payload: { id } });
    },
    [self.id],
  );

  const updateNote = useCallback(
    (id, patch) => {
      const current = notesRef.current.find((n) => n.id === id);
      if (!current) return null;
      const note = {
        ...current,
        ...patch,
        id: current.id,
        author: current.author,
        updatedAt: new Date().toISOString(),
      };
      upsertNotes([note]);
      transportRef.current?.post({ type: 'note:add', from: self.id, payload: note });
      return note;
    },
    [self.id, upsertNotes],
  );

  const replyToNote = useCallback(
    (id, text) => {
      const value = (text || '').trim();
      if (!value) return null;
      const current = notesRef.current.find((n) => n.id === id);
      if (!current) return null;
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
      };
      upsertNotes([note]);
      transportRef.current?.post({ type: 'note:reply', from: self.id, payload: note });
      return note;
    },
    [self, upsertNotes],
  );

  const resolveNote = useCallback(
    (id, resolved) => {
      const current = notesRef.current.find((n) => n.id === id);
      if (!current) return null;
      const note = {
        ...current,
        resolved: Boolean(resolved),
        updatedAt: new Date().toISOString(),
      };
      upsertNotes([note]);
      transportRef.current?.post({ type: 'note:resolve', from: self.id, payload: note });
      return note;
    },
    [self.id, upsertNotes],
  );

  const toggleLike = useCallback(
    (noteId) => {
      setNotes((prev) => {
        const note = prev.find((n) => n.id === noteId);
        if (!note) return prev;
        const likes = note.likes || [];
        const idx = likes.findIndex((l) => l.id === self.id);
        const updated = {
          ...note,
          likes:
            idx >= 0
              ? likes.filter((l) => l.id !== self.id)
              : [...likes, { id: self.id, name: self.name }],
        };
        const result = prev.map((n) => (n.id === noteId ? updated : n));
        transportRef.current?.post({ type: 'note:like', from: self.id, payload: updated });
        return result;
      });
    },
    [self],
  );

  const addReply = useCallback(
    (noteId, text) => {
      if (!text.trim()) return;
      const reply = {
        id: shortId(),
        author: { id: self.id, name: self.name, color: self.color },
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };
      setNotes((prev) => {
        const note = prev.find((n) => n.id === noteId);
        if (!note) return prev;
        const updated = {
          ...note,
          replies: [...(note.replies || []), reply],
        };
        const result = prev.map((n) => (n.id === noteId ? updated : n));
        transportRef.current?.post({
          type: 'note:reply',
          from: self.id,
          payload: updated,
        });
        return result;
      });
    },
    [self],
  );

  const deleteReply = useCallback(
    (noteId, replyId) => {
      setNotes((prev) => {
        const note = prev.find((n) => n.id === noteId);
        if (!note) return prev;
        const updated = {
          ...note,
          replies: (note.replies || []).filter((r) => r.id !== replyId),
        };
        const result = prev.map((n) => (n.id === noteId ? updated : n));
        transportRef.current?.post({
          type: 'note:reply',
          from: self.id,
          payload: updated,
        });
        return result;
      });
    },
    [self],
  );

  const updateNoteShapes = useCallback(
    (noteId, shapes) => {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, shapes } : n)));
      transportRef.current?.post({
        type: 'note:update',
        from: self.id,
        payload: { id: noteId, shapes },
      });
    },
    [self.id],
  );

  const replaceNotes = useCallback(
    (incoming) => {
      const clean = (incoming || [])
        .filter((n) => typeof n.time === 'number')
        .sort((a, b) => a.time - b.time);
      setNotes(clean);
      transportRef.current?.post({
        type: 'sync:state',
        from: self.id,
        payload: { notes: clean },
      });
    },
    [self.id],
  );

  const lastCursorRef = useRef(0);
  const sendCursor = useCallback(
    (nx, ny) => {
      const now = Date.now();
      if (now - lastCursorRef.current < 55) return;
      lastCursorRef.current = now;
      transportRef.current?.post({
        type: 'cursor',
        from: self.id,
        payload: { x: nx, y: ny, name: self.name, color: self.color },
      });
    },
    [self],
  );

  const claimPresenter = useCallback(() => {
    setPresenterId(self.id);
    transportRef.current?.post({ type: 'wt:claim', from: self.id });
  }, [self.id]);

  const releasePresenter = useCallback(() => {
    setPresenterId(null);
    transportRef.current?.post({ type: 'wt:release', from: self.id });
  }, [self.id]);

  const sendPlayback = useCallback(
    ({ action, position }) => {
      lastPlaybackRef.current = {
        paused: action !== 'play',
        position,
        at: Date.now(),
      };
      transportRef.current?.post({
        type: 'wt:playback',
        from: self.id,
        payload: { action, position, at: Date.now() },
      });
    },
    [self.id],
  );

  const sendHeartbeat = useCallback(
    ({ position, paused }) => {
      lastPlaybackRef.current = { paused, position, at: Date.now() };
      transportRef.current?.post({
        type: 'wt:heartbeat',
        from: self.id,
        payload: { position, paused, at: Date.now() },
      });
    },
    [self.id],
  );

  const subscribePlayback = useCallback((fn) => {
    playbackListenersRef.current.add(fn);
    return () => playbackListenersRef.current.delete(fn);
  }, []);

  const peerList = useMemo(() => Object.values(peers), [peers]);
  const isPresenter = presenterId === self.id;

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
    subscribePlayback,
  };
}
