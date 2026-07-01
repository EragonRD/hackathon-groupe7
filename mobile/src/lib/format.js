// Helpers de présentation purs (testables, sans effet de bord).

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

export function colorForUser(key) {
  const s = String(key ?? '')
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  }
  return USER_COLORS[hash % USER_COLORS.length]
}

export function initials(name) {
  const parts = String(name ?? '?')
    .trim()
    .split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${m}:${pad(sec)}`
}

export function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 10) return "À l'instant"
  if (diff < 60) return 'Il y a quelques secondes'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  if (diff < 2592000) return `Il y a ${Math.floor(diff / 86400)} j`
  return `Il y a ${Math.floor(diff / 2592000)} mois`
}

export function shortId() {
  return Math.random().toString(36).slice(2, 10)
}
