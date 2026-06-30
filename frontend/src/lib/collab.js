// ============================================================================
//  Couche temps réel — transport abstrait
// ----------------------------------------------------------------------------
//  Contrat (identique quel que soit l'adapter) :
//
//    const t = createTransport(session, { mode })
//    t.post({ type, payload, from })   // émet un message à TOUS les autres pairs
//    const off = t.subscribe((msg) => …) // reçoit les messages des autres pairs
//    t.close()
//
//  Adapter par défaut : BroadcastChannel.
//    -> synchronise plusieurs FENÊTRES/onglets du même navigateur, 100% offline,
//       zéro backend. Suffisant pour la démo multi-fenêtres exigée par le sujet.
//
//  Adapter futur : socket.io (LAN, 2-3 machines).
//    -> même contrat. socket.io-client est déjà une dépendance du projet ;
//       l'import est dynamique pour ne pas se connecter tant qu'on ne choisit pas
//       ce mode. Côté Core (NestJS), une gateway @WebSocketGateway relaiera
//       simplement les messages aux membres de la room `session`.
//
//  IMPORTANT : un transport ne RÉÉMET jamais à l'expéditeur. Chaque message
//  porte `from` (id auteur) ; côté React on ignore ses propres messages.
// ============================================================================

const PREFIX = 'review:'

// --- Adapter 1 : BroadcastChannel (actif par défaut) -----------------------
function broadcastTransport(session) {
  // BroadcastChannel ne livre PAS les messages à l'onglet émetteur : parfait.
  const ch = new BroadcastChannel(PREFIX + session)
  const listeners = new Set()

  ch.onmessage = (e) => {
    for (const fn of listeners) fn(e.data)
  }

  return {
    mode: 'broadcast',
    post(msg) {
      ch.postMessage(msg)
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    close() {
      listeners.clear()
      ch.close()
    },
  }
}

// --- Adapter 2 : socket.io (LAN) — branchable plus tard --------------------
// Non connecté tant que mode !== 'socket'. Le serveur doit exposer une gateway
// qui, sur `post`, fait socket.to(room).emit('msg', data) (pas de retour à l'envoyeur).
function socketTransport(session, { url = 'http://localhost:3000' } = {}) {
  const listeners = new Set()
  let socket = null

  // Import dynamique : aucun coût/connexion si ce mode n'est pas choisi.
  import('socket.io-client')
    .then(({ io }) => {
      socket = io(url, { transports: ['websocket'], query: { session } })
      socket.emit('join', { session })
      socket.on('msg', (data) => {
        for (const fn of listeners) fn(data)
      })
    })
    .catch((err) => {
      console.error('[collab] socket.io indisponible, mode LAN inactif :', err)
    })

  return {
    mode: 'socket',
    post(msg) {
      if (socket) socket.emit('msg', { ...msg, session })
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    close() {
      listeners.clear()
      if (socket) socket.disconnect()
    },
  }
}

// Fabrique : choisit l'adapter. `mode` peut venir d'une variable d'env Vite
// (VITE_COLLAB_MODE) pour basculer en LAN sans toucher l'UI.
export function createTransport(session, opts = {}) {
  const mode = opts.mode ?? import.meta.env?.VITE_COLLAB_MODE ?? 'broadcast'

  if (mode === 'socket') return socketTransport(session, opts)

  // Repli sûr : si BroadcastChannel n'existe pas (très vieux navigateur),
  // on renvoie un transport inerte plutôt que de planter (mode mono-fenêtre).
  if (typeof BroadcastChannel === 'undefined') {
    return {
      mode: 'none',
      post() {},
      subscribe() {
        return () => {}
      },
      close() {},
    }
  }
  return broadcastTransport(session)
}
