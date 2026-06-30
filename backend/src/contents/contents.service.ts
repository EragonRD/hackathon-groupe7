import { Injectable } from '@nestjs/common'

export interface Content {
  id: string
  title: string
  allowedUsers: string[]
  revoked: boolean
}

// Catalogue + droits d'accès EN MÉMOIRE (remplace l'ACL codée en dur).
// Partagé entre KeysService (vérif d'accès à la clé) et le back-office admin
// (octroi/retrait de droits, révocation de clé en direct).
@Injectable()
export class ContentsService {
  private readonly contents = new Map<string, Content>([
    [
      'poc',
      {
        id: 'poc',
        title: 'POC Parc des Princes',
        allowedUsers: ['alice', 'bob', 'carol'],
        revoked: false,
      },
    ],
  ])

  list(): Content[] {
    return [...this.contents.values()].map((c) => ({
      ...c,
      allowedUsers: [...c.allowedUsers],
    }))
  }

  find(id: string): Content | undefined {
    return this.contents.get(id)
  }

  // true seulement si le contenu existe, n'est pas révoqué, et l'utilisateur est autorisé.
  isAllowed(id: string, username: string): boolean {
    const c = this.contents.get(id)
    return !!c && !c.revoked && c.allowedUsers.includes(username)
  }

  grantAccess(id: string, username: string): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    if (!c.allowedUsers.includes(username)) c.allowedUsers.push(username)
    return c
  }

  revokeAccess(id: string, username: string): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    c.allowedUsers = c.allowedUsers.filter((u) => u !== username)
    return c
  }

  // Révocation / restauration de la clé : bloque (ou rétablit) la délivrance.
  setRevoked(id: string, revoked: boolean): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    c.revoked = revoked
    return c
  }
}
