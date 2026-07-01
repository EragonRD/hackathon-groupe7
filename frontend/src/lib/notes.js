import { authFetch } from '../auth'

// Persistance SERVEUR des notes de revue (par session), en complément du temps réel.
// Best-effort : en cas d'échec (offline, 401, quota), on retombe silencieusement sur
// la synchro live + le miroir localStorage — l'UI n'est jamais bloquée.

// Renvoie le tableau de notes persisté (même vide) si la requête a abouti, sinon
// `null` (erreur/offline) — le distinguo évite d'écraser le serveur après un échec.
export async function fetchNotes(session) {
  try {
    const res = await authFetch(`/notes/${encodeURIComponent(session)}`)
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

// Remplace l'état persisté de la session. Silencieux en cas d'échec.
export async function saveNotes(session, notes) {
  try {
    await authFetch(`/notes/${encodeURIComponent(session)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
  } catch {
    /* best-effort : la synchro live + localStorage restent la source */
  }
}
