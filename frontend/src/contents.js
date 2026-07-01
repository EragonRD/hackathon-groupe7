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
