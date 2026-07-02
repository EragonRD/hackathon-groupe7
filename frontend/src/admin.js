// Couche d'accès au back-office multi-tenant (routes /admin/* du Core NestJS).
// On réutilise `authFetch` (token + intercepteur 401) et on centralise ici le
// mapping des codes d'erreur vers des messages clairs pour un public non
// technique. Contrat des endpoints : voir docs/FRONTEND-INTEGRATION.md §9.3.
import { authFetch, getToken } from './auth'
import { listMyContents } from './contents'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Messages par code HTTP. On privilégie le message serveur quand il est parlant
// (NestJS renvoie { message } ou { message: string[] } sur les exceptions).
function mapError(status, serverMsg) {
  switch (status) {
    case 400:
      return serverMsg || 'Requête invalide.'
    case 401:
      return 'Session expirée. Reconnectez-vous.'
    case 403:
      return serverMsg || 'Accès refusé (droits insuffisants).'
    case 404:
      return serverMsg || 'Élément introuvable.'
    case 409:
      return serverMsg || 'Conflit : cet élément existe déjà.'
    default:
      return serverMsg || 'Erreur serveur, réessayez.'
  }
}

async function request(path, options) {
  const res = await authFetch(path, options)
  if (res.ok) {
    // Toutes les routes /admin/* renvoient du JSON ; on tolère un corps vide.
    const text = await res.text()
    return text ? JSON.parse(text) : null
  }
  let serverMsg = null
  try {
    const data = await res.json()
    serverMsg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
  } catch {
    /* pas de corps JSON exploitable */
  }
  throw new Error(mapError(res.status, serverMsg))
}

// Corps JSON pour un POST.
function post(body) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// ───────────── Super-admin : entreprises (tenants) ─────────────
export const listCompanies = () => request('/admin/companies')
export const createCompany = (name) => request('/admin/companies', post({ name }))
export const inviteAdmin = (companyId, email) =>
  request(
    `/admin/companies/${encodeURIComponent(companyId)}/invite-admin`,
    post({ email }),
  )
// Suppression CASCADE (retire aussi les users et contenus de l'entreprise).
export const deleteCompany = (companyId) =>
  request(`/admin/companies/${encodeURIComponent(companyId)}`, { method: 'DELETE' })

// ───────────── Admin : utilisateurs ─────────────
// payload : { username, password, companyId? } (companyId requis pour un superadmin)
export const listUsers = () => request('/admin/users')
export const createUser = (payload) => request('/admin/users', post(payload))
// Changer le rôle d'un compte (superadmin) : role vaut 'admin' ou 'user'.
export const setUserRole = (username, role) =>
  request(`/admin/users/${encodeURIComponent(username)}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
// Supprimer un compte (superadmin partout, admin dans sa societe).
export const deleteUser = (username) =>
  request(`/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' })

// ───────────── Admin : contenus + droits d'accès ─────────────
// payload create : { title, companyId? } (companyId requis pour un superadmin)
export const listContents = () => request('/admin/contents')
export const createContent = (payload) => request('/admin/contents', post(payload))

// Upload d'une vidéo (multipart) avec progression. Le Core la chiffre en HLS
// AES-128 en tâche de fond → le contenu revient en `status: 'processing'`.
// onProgress(percent) est appelé pendant le transfert.
export async function uploadContent({ file, title, onProgress }) {
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
      xhr.open('POST', `${API}/admin/contents/upload-chunk`)
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
          let serverMsg = null
          try {
            const data = JSON.parse(xhr.responseText)
            serverMsg = Array.isArray(data?.message)
              ? data.message.join(', ')
              : data?.message
          } catch {
            /* pas de corps JSON */
          }
          reject(new Error(mapError(xhr.status, serverMsg)))
        }
      }

      xhr.onerror = () => reject(new Error('Upload échoué (réseau).'))

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
// Statut d'un contenu — pour suivre le chiffrement après upload.
// On lit le catalogue UTILISATEUR (/contents), accessible à TOUT membre
// (contrairement à /admin/contents réservé aux admins, qui renvoyait un 403 à un
// simple `user` et bloquait le suivi). Le flag `playable` (clé AES provisionnée +
// contenu non révoqué) signale que le chiffrement HLS est prêt.
export async function getContentStatus(id) {
  const list = await listMyContents()
  const item = (list || []).find((c) => c.id === id)
  if (!item) return null
  return item.playable ? 'ready' : 'processing'
}

// Poll jusqu'à `ready` (résout true) ou `failed`/timeout (résout false).
export async function waitUntilReady(id, { intervalMs = 1500, timeoutMs = 300000 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await getContentStatus(id).catch(() => null)
    if (status === 'ready') return true
    if (status === 'failed') return false
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

export const grantAccess = (id, username) =>
  request(`/admin/contents/${encodeURIComponent(id)}/access`, post({ username }))
export const revokeAccess = (id, username) =>
  request(
    `/admin/contents/${encodeURIComponent(id)}/access/${encodeURIComponent(username)}`,
    { method: 'DELETE' },
  )
export const revokeKey = (id) =>
  request(`/admin/contents/${encodeURIComponent(id)}/revoke`, { method: 'POST' })
export const restoreKey = (id) =>
  request(`/admin/contents/${encodeURIComponent(id)}/restore`, { method: 'POST' })
// Supprime définitivement un contenu (enregistrement + HLS chiffré + clé).
export const deleteContent = (id) =>
  request(`/admin/contents/${encodeURIComponent(id)}`, { method: 'DELETE' })
