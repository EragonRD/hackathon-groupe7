// Petit helper d'authentification (point de départ — adaptez-le à votre app).
// Il parle au Core NestJS (`backend/`) : login, stockage du token, fetch authentifié.

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
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

// Rôle lu depuis le payload du JWT (sans appel réseau). 'admin' | 'member' | null.
export function getRole() {
  const t = getToken()
  if (!t) return null
  try {
    return JSON.parse(atob(t.split('.')[1])).role ?? null
  } catch {
    return null
  }
}

export function isAdmin() {
  return getRole() === 'admin'
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

// fetch authentifié : ajoute `Authorization: Bearer <token>` + intercepteur 401.
// Sur 401 (token absent/expiré/invalide), on déconnecte et on émet `auth:expired`
// pour que l'app retourne à l'écran de connexion. Le code appelant reçoit quand
// même la réponse et peut la traiter.
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
    logout()
    window.dispatchEvent(new Event('auth:expired'))
  }
  return res
}
