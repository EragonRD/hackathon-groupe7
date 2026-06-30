// Helpers de présentation purs (testables, sans effet de bord).

// Palette stable pour identifier visuellement chaque participant.
// (Couleurs lisibles sur fond sombre, texte foncé par-dessus.)
const USER_COLORS = [
  '#4d9bff',
  '#2ec27e',
  '#f5a623',
  '#ff5b7f',
  '#b07bff',
  '#29c5e6',
  '#ff8a3d',
  '#5be0b0',
]

// Affecte une couleur déterministe à partir d'une chaîne (id ou pseudo)
// pour que le même utilisateur ait toujours la même couleur partout.
export function colorForUser(key) {
  const s = String(key ?? '')
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  }
  return USER_COLORS[hash % USER_COLORS.length]
}

// Initiales pour les pastilles d'avatar (max 2 lettres).
export function initials(name) {
  const parts = String(name ?? '?')
    .trim()
    .split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Secondes -> "M:SS" (ou "H:MM:SS" au-delà d'une heure).
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${m}:${pad(sec)}`
}

// Identifiant court unique-ish, sans dépendance (crypto si dispo, sinon fallback).
export function shortId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}
