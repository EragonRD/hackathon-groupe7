import { Injectable } from '@nestjs/common'
import { randomUUID } from 'crypto'
import type { JwtUser } from '../common/request-context'

export interface Content {
  id: string
  title: string
  companyId: string // entreprise propriétaire (tenant)
  allowedUsernames: string[]
  revoked: boolean
}

// Catalogue + droits d'accès EN MÉMOIRE, isolé PAR ENTREPRISE (multi-tenant).
// Partagé entre KeysService (vérif d'accès à la clé) et le back-office admin.
@Injectable()
export class ContentsService {
  private readonly contents = new Map<string, Content>([
    [
      'poc',
      {
        id: 'poc',
        title: 'POC Parc des Princes',
        companyId: 'demo',
        allowedUsernames: ['alice', 'bob', 'carol'],
        revoked: false,
      },
    ],
  ])

  list(): Content[] {
    return [...this.contents.values()].map((c) => this.clone(c))
  }

  listByCompany(companyId: string | null): Content[] {
    return this.list().filter((c) => c.companyId === companyId)
  }

  find(id: string): Content | undefined {
    return this.contents.get(id)
  }

  create(input: { title: string; companyId: string }): Content {
    const id = randomUUID().slice(0, 8)
    const content: Content = {
      id,
      title: input.title,
      companyId: input.companyId,
      allowedUsernames: [],
      revoked: false,
    }
    this.contents.set(id, content)
    return this.clone(content)
  }

  // Accès à la clé : même entreprise (ou superadmin), non révoqué, et autorisé.
  isAllowed(contentId: string, user: JwtUser): boolean {
    const c = this.contents.get(contentId)
    if (!c || c.revoked) return false
    if (user.role === 'superadmin') return true
    if (c.companyId !== user.companyId) return false
    return c.allowedUsernames.includes(user.username)
  }

  grantAccess(id: string, username: string): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    if (!c.allowedUsernames.includes(username)) c.allowedUsernames.push(username)
    return this.clone(c)
  }

  revokeAccess(id: string, username: string): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    c.allowedUsernames = c.allowedUsernames.filter((u) => u !== username)
    return this.clone(c)
  }

  setRevoked(id: string, revoked: boolean): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    c.revoked = revoked
    return this.clone(c)
  }

  private clone(c: Content): Content {
    return { ...c, allowedUsernames: [...c.allowedUsernames] }
  }
}
