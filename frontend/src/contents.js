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

// (Re)lance l'analyse IA d'un contenu DÉJÀ uploadé (jamais analysé, ou en erreur).
// Le Core reconstruit l'audio depuis le HLS chiffré puis démarre l'analyse.
// Renvoie { status } ('processing' si lancée, 'done'/'processing' si déjà faite).
export async function requestAnalysis(contentId) {
  const res = await authFetch(
    `/admin/contents/${encodeURIComponent(contentId)}/analyze`,
    {
      method: 'POST',
    },
  )
  if (res.ok) return res.json()
  if (res.status === 401) throw new Error('Session expirée. Reconnectez-vous.')
  if (res.status === 403) throw new Error("Vous n'avez pas accès à ce contenu.")
  if (res.status === 404) throw new Error('Contenu introuvable.')
  const body = await res.json().catch(() => ({}))
  throw new Error(body?.message ?? `Analyse impossible (${res.status}).`)
}

// Traduction À LA DEMANDE d'une langue (test temps réel). Réutilise le pipeline
// Engine (segments déjà analysés). Renvoie { lang, text, segments:[{start,end,text}] }.
export async function translateContent(contentId, lang) {
  const res = await authFetch(`/contents/${encodeURIComponent(contentId)}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang }),
  })
  if (res.ok) return res.json()
  if (res.status === 401) throw new Error('Session expirée. Reconnectez-vous.')
  if (res.status === 409) throw new Error("L'analyse de ce contenu n'est pas terminée.")
  const body = await res.json().catch(() => ({}))
  throw new Error(body?.message ?? `Traduction indisponible (${res.status}).`)
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
export async function uploadGuestContent({ file, title, onProgress }) {
  const CHUNK_SIZE = 10 * 1024 * 1024 // 10 Mo
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const uploadId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36)

  let lastResponse = null

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    const uploadedBefore = i * CHUNK_SIZE

    lastResponse = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API}/contents/guest-upload-chunk`)
      const token = getToken()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const loaded = uploadedBefore + e.loaded
          onProgress(Math.min(99, Math.round((loaded / file.size) * 100)))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            resolve(null)
          }
        } else {
          reject(
            new Error(xhr.status === 403 ? 'Envoi non autorisé.' : "Échec de l'envoi."),
          )
        }
      }

      xhr.onerror = () => reject(new Error('Envoi échoué (réseau).'))

      const form = new FormData()
      form.append('file', chunk, file.name)
      form.append('chunkIndex', i.toString())
      form.append('totalChunks', totalChunks.toString())
      form.append('uploadId', uploadId)
      form.append('title', title)

      xhr.send(form)
    })
  }

  if (onProgress) onProgress(100)
  return lastResponse
}
