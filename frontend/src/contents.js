// Catalogue côté utilisateur : les contenus de SON organisation auxquels il a
// accès (endpoint /contents, distinct du back-office /admin/contents). Chaque
// entrée porte un drapeau `playable` (clé AES provisionnée et non révoquée).
import { authFetch, getToken } from './auth'

const API =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3000')

export async function listMyContents() {
  const res = await authFetch('/contents')
  if (res.ok) {
    const text = await res.text()
    return text ? JSON.parse(text) : []
  }
  if (res.status === 401) throw new Error('Session expirée. Reconnectez-vous.')
  throw new Error('Impossible de charger vos contenus.')
}

// Métadonnées IA d'un contenu (contrat P3-A). Le Core répond par un statut :
//   200 -> analyse prête (données)   202 -> en cours   404 -> pas d'analyse
//   409 -> erreur d'analyse
// On normalise en { status, data?, error? } pour simplifier le rendu côté UI.
export async function getMetadata(contentId) {
  const res = await authFetch(`/contents/${encodeURIComponent(contentId)}/metadata`)
  if (res.status === 200) return { status: 'done', data: await res.json() }
  if (res.status === 202) return { status: 'processing' }
  if (res.status === 404) return { status: 'not_analyzed' }
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}))
    return { status: 'error', error: body?.error ?? 'Analyse en erreur' }
  }
  if (res.status === 401) throw new Error('Session expirée. Reconnectez-vous.')
  if (res.status === 403) return { status: 'not_analyzed' } // pas d'accès -> on masque
  return { status: 'error', error: `Réponse inattendue (${res.status})` }
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

// Upload par un INVITÉ (token guest) : la vidéo est ajoutée à l'entreprise de la
// session et donnée au membre invitant + aux admins. « Fire-and-forget » : on
// renvoie dès la réception (le chiffrement se fait en tâche de fond côté Core).
export function uploadGuestContent({ file, title, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}/contents/guest-upload`)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve(null)
        }
        return
      }
      reject(new Error(xhr.status === 403 ? 'Envoi non autorisé.' : "Échec de l'envoi."))
    }
    xhr.onerror = () => reject(new Error('Envoi échoué (réseau).'))
    const form = new FormData()
    form.append('file', file)
    form.append('title', title)
    xhr.send(form)
  })
}
