import { Injectable } from '@nestjs/common'
import { randomUUID } from 'crypto'

export interface Company {
  id: string
  name: string
}

// Catalogue des entreprises (tenants) EN MÉMOIRE. Géré par les super-admins.
@Injectable()
export class CompaniesService {
  private readonly companies = new Map<string, Company>([
    ['demo', { id: 'demo', name: 'Demo Corp' }],
  ])

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
    return company
  }
}
