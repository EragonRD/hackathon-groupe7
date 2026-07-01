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

// --- Adapter 2 : socket.io (LAN, 2-3 machines) -----------------------------
// Parle à la gateway NestJS (ReviewGateway) : on émet `join {session}` puis des
// `msg` ; le serveur relaie chaque `msg` aux AUTRES membres de la room `session`
// (jamais à l'émetteur -> pas d'écho serveur). Même contrat que l'adapter
// BroadcastChannel, donc l'UI est identique.
function socketTransport(session, { url } = {}) {
  // Même logique que auth.js : PROD -> même origine (nginx proxifie /socket.io),
  // dev -> :3000. `io(undefined)` se connecte à l'origine courante.
  const API =
    url ??
    import.meta.env?.VITE_API_URL ??
    (import.meta.env?.PROD ? '' : 'http://localhost:3000')
  // Token d'auth (handshake) : identité best-effort côté Core. Clé partagée
  // avec auth.js. Lecture défensive (mode privé / quota).
  let token = null
  try {
    token = localStorage.getItem('hackathon_token')
  } catch {
    token = null
  }

  const listeners = new Set()
  let socket = null

  // Import dynamique : aucun coût/connexion tant que ce mode n'est pas choisi.
  import('socket.io-client')
    .then(({ io }) => {
      // '' (prod same-origin) -> undefined -> socket.io se connecte à l'origine.
      socket = io(API || undefined, {
        transports: ['websocket', 'polling'],
        auth: { token },
        query: { session },
      })
      // (Re)joindre la room à chaque connexion (couvre la reconnexion auto).
      socket.on('connect', () => socket.emit('join', { session }))
      socket.on('msg', (data) => {
        for (const fn of listeners) fn(data)
      })
      socket.on('connect_error', (err) => {
        console.error('[collab] connexion LAN refusée :', err?.message || err)
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
