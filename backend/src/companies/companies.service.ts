import { Injectable } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { loadJson, saveJson } from '../common/json-store'

export interface Company {
  id: string
  name: string
}

const STORE = 'companies.json'
// Entreprise de démo semée au tout premier lancement (fichier absent).
const SEED: Company[] = [{ id: 'demo', name: 'Demo Corp' }]

// Catalogue des entreprises (tenants). Persisté sur disque (backend/data) :
// survit au redémarrage. Géré par les super-admins.
@Injectable()
export class CompaniesService {
  private readonly companies = new Map<string, Company>()

  constructor() {
    // Charge le disque ; à défaut (premier lancement), sème et persiste.
    const stored = loadJson<Company[] | null>(STORE, null)
    const initial = stored ?? SEED
    for (const c of initial) this.companies.set(c.id, c)
    if (!stored) this.persist()
  }

  list(): Company[] {
    return [...this.companies.values()]
  }

  find(id: string): Company | undefined {
    return this.companies.get(id)
  }

  create(name: string): Company {
    const id = randomUUID().slice(0, 8)
    const company: Company = { id, name }
    this.companies.set(id, company)
    this.persist()
    return company
  }

  // Supprime l'entreprise. La cascade (users + contenus) est orchestrée par le
  // contrôleur qui appelle aussi les services users/contents.
  delete(id: string): boolean {
    const ok = this.companies.delete(id)
    if (ok) this.persist()
    return ok
  }

  private persist(): void {
    saveJson(STORE, [...this.companies.values()])
  }
}
