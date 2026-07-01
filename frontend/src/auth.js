// Petit helper d'authentification (point de départ — adaptez-le à votre app).
// Il parle au Core NestJS (`backend/`) : login, stockage du token, fetch authentifié.

// URL du Core. En dev, defaut sur :3000. En build PROD, defaut sur MEME ORIGINE
// (chaine vide -> requetes relatives -> nginx proxifie vers le Core) : pas besoin
// de configurer VITE_API_URL en prod derriere le reverse-proxy.
const API =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3000')
const TOKEN_KEY = 'hackathon_token'

export async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    // Messages clairs pour des utilisateurs non techniques.
    if (res.status === 429) {
      throw new Error('Trop de tentatives. Réessayez dans quelques minutes.')
    }
    throw new Error('Identifiant ou mot de passe incorrect.')
  }
  const data = await res.json()
  localStorage.setItem(TOKEN_KEY, data.accessToken)
  return data.user
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

// Claims du JWT décodés depuis le payload (sans appel réseau, sans vérif de
// signature — pour l'affichage uniquement, jamais pour une décision de sécurité).
// { role, companyId, mustChangePassword, ... } ou null.
export function getClaims() {
  const t = getToken()
  if (!t) return null
  try {
    return JSON.parse(atob(t.split('.')[1]))
  } catch {
    return null
  }
}

// Rôle : 'superadmin' | 'admin' | 'user' | null.
export function getRole() {
  return getClaims()?.role ?? null
}

export function getCompanyId() {
  return getClaims()?.companyId ?? null
}

// superadmin est un admin (global) : il doit voir tout ce qu'un admin voit.
export function isAdmin() {
  return ['admin', 'superadmin'].includes(getRole())
}

export function isSuperAdmin() {
  return getRole() === 'superadmin'
}

// Admin invité tant qu'il n'a pas changé son mot de passe temporaire.
export function mustChangePwd() {
  return Boolean(getClaims()?.mustChangePassword)
}

// Réhydrate l'utilisateur courant à partir du token (au rechargement de page).
// Renvoie l'utilisateur si le token est valide, sinon null (et nettoie le token).
export async function me() {
  if (!getToken()) return null
  try {
    const res = await authFetch('/auth/me')
    if (!res.ok) {
      logout()
      return null
    }
    return await res.json()
  } catch {
    return null
  }
}

// Changement de mot de passe (1re connexion d'un admin invité, ou volontaire).
// Renvoie un NOUVEAU token sans le flag mustChangePassword : on le stocke et on
// renvoie l'utilisateur à jour. Lève une erreur au libellé clair sinon.
export async function changePassword(currentPassword, newPassword) {
  const res = await authFetch('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!res.ok) {
    let serverMsg = null
    try {
      const data = await res.json()
      serverMsg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message
    } catch {
      /* pas de corps JSON exploitable */
    }
    if (res.status === 401) throw new Error('Mot de passe actuel incorrect.')
    throw new Error(serverMsg || 'Impossible de changer le mot de passe.')
  }
  const data = await res.json()
  localStorage.setItem(TOKEN_KEY, data.accessToken)
  return data.user
}

// fetch authentifié : ajoute `Authorization: Bearer <token>` + intercepteur 401.
// Sur 401 (token absent/expiré/invalide), on déconnecte et on émet `auth:expired`
// pour que l'app retourne à l'écran de connexion. Le code appelant reçoit quand
// même la réponse et peut la traiter.
//
// Mono-session : le Core renvoie `message: 'session_superseded'` quand le compte a
// été rouvert ailleurs (le dernier gagne). On propage la raison pour que l'app
// affiche « déconnecté par une autre session » — distinct d'une simple expiration.
export async function authFetch(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401 && token) {
    let reason = null
    try {
      // clone() : on lit le corps sans le consommer pour l'appelant.
      const data = await res.clone().json()
      if (data?.message === 'session_superseded') reason = 'session_superseded'
    } catch {
      /* pas de corps JSON exploitable */
    }
    logout()
    window.dispatchEvent(new CustomEvent('auth:expired', { detail: { reason } }))
  }
  return res
}
