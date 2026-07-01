// Catalogue côté utilisateur : les contenus de SON organisation auxquels il a
// accès (endpoint /contents, distinct du back-office /admin/contents). Chaque
// entrée porte un drapeau `playable` (clé AES provisionnée et non révoquée).
import { authFetch } from './auth'

export async function listMyContents() {
  const res = await authFetch('/contents')
  if (res.ok) {
    const text = await res.text()
    return text ? JSON.parse(text) : []
  }
  if (res.status === 401) throw new Error('Session expirée. Reconnectez-vous.')
  throw new Error('Impossible de charger vos contenus.')
}

// Génère un lien d'invité temporaire pour un contenu. ttl ∈ '15m' | '1h' | '24h'.
// Renvoie { token, shareUrl, expiresAt }.
export async function inviteGuest(contentId, ttl) {
  const res = await authFetch(`/contents/${encodeURIComponent(contentId)}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl }),
  })
  if (res.ok) return res.json()
  if (res.status === 403) throw new Error("Vous n'avez pas accès à ce contenu.")
  if (res.status === 401) throw new Error('Session expirée. Reconnectez-vous.')
  throw new Error("Impossible de générer le lien d'invitation.")
}
