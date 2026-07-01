// Couche d'accès au back-office multi-tenant (routes /admin/* du Core NestJS).
// On réutilise `authFetch` (token + intercepteur 401) et on centralise ici le
// mapping des codes d'erreur vers des messages clairs pour un public non
// technique. Contrat des endpoints : voir docs/FRONTEND-INTEGRATION.md §9.3.
import { authFetch } from './auth'

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
