import { Injectable } from '@nestjs/common'
import { loadJson, saveJson } from '../common/json-store'

const STORE = 'notes.json'
// Garde-fou mémoire/disque : borne le nombre de notes conservées par session.
const MAX_NOTES_PER_SESSION = 1000

// Persistance des notes de revue (commentaires + dessins) PAR session, dans le
// volume de données (poulpium_data via json-store). Complète la synchro temps réel
// (relais socket.io) : les notes SURVIVENT au départ de tous les participants et
// sont rechargées quand quelqu'un rouvre le contenu, sur n'importe quelle machine.
//
// Le client reste la source du contenu des notes (il possède déjà le réducteur) :
// ici on stocke bêtement le tableau complet par session. Dernier écrivain gagne
// (les clients connectés sont convergés via le relais, donc leurs tableaux matchent).
@Injectable()
export class NotesService {
  private readonly bySession: Record<string, unknown[]>

  constructor() {
    this.bySession = loadJson<Record<string, unknown[]>>(STORE, {})
  }

  get(session: string): unknown[] {
    return this.bySession[session] ?? []
  }

  replace(session: string, notes: unknown[]): unknown[] {
    const capped = Array.isArray(notes) ? notes.slice(0, MAX_NOTES_PER_SESSION) : []
    // Session vidée -> on retire la clé (pas d'accumulation de tableaux vides).
    if (capped.length === 0) delete this.bySession[session]
    else this.bySession[session] = capped
    this.persist()
    return capped
  }

  private persist(): void {
    saveJson(STORE, this.bySession)
  }
}
