import { Injectable } from '@nestjs/common'
import { randomUUID } from 'crypto'
import type { JwtUser } from '../common/request-context'
import { loadJson, saveJson } from '../common/json-store'

export type ContentStatus = 'ready' | 'processing' | 'failed'

export interface Content {
  id: string
  title: string
  companyId: string // entreprise propriétaire (tenant)
  allowedUsernames: string[]
  revoked: boolean
  status: ContentStatus // 'processing' pendant le chiffrement de l'upload
}

const STORE = 'contents.json'
// Aucun contenu semé : un enregistrement seul (sans ses artefacts HLS + clé AES)
// s'afficherait comme « Flux indisponible » (bug de démo). Les contenus se créent
// par UPLOAD, qui génère le HLS chiffré + la clé. Catalogue vide au tout premier
// lancement, jusqu'au premier upload.
const SEED: Content[] = []

// Catalogue + droits d'accès, isolé PAR ENTREPRISE (multi-tenant). Persisté sur
// disque (backend/data) : survit au redémarrage. Partagé entre KeysService
// (vérif d'accès à la clé) et le back-office admin.
@Injectable()
export class ContentsService {
  private readonly contents = new Map<string, Content>()

  constructor() {
    // Charge le disque ; à défaut (premier lancement), sème et persiste.
    type StoredContent = Omit<Content, 'status'> & { status?: ContentStatus }
    const stored = loadJson<StoredContent[] | null>(STORE, null)
    const initial: StoredContent[] = stored ?? SEED
    // Normalise : les contenus persistés avant l'ajout du champ `status` sont `ready`.
    for (const c of initial) {
      this.contents.set(c.id, this.clone({ ...c, status: c.status ?? 'ready' }))
    }
    if (!stored) this.persist()
  }

  list(): Content[] {
    return [...this.contents.values()].map((c) => this.clone(c))
  }

  listByCompany(companyId: string | null): Content[] {
    return this.list().filter((c) => c.companyId === companyId)
  }

  // Catalogue d'un utilisateur : les contenus de SON entreprise auxquels il est
  // explicitement autorisé (révoqués inclus, pour les afficher comme indisponibles).
  // Un compte sans entreprise (superadmin) n'a aucun contenu.
  listForUser(user: JwtUser): Content[] {
    if (!user.companyId) return []
    return this.list().filter(
      (c) => c.companyId === user.companyId && c.allowedUsernames.includes(user.username),
    )
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
      status: 'ready',
    }
    this.contents.set(id, content)
    this.persist()
    return this.clone(content)
  }

  // Contenu issu d'un UPLOAD : id généré, statut `processing` (le chiffrement suit),
  // et l'auteur (admin) est autorisé d'office pour pouvoir le visionner une fois prêt.
  createUploaded(input: {
    title: string
    companyId: string
    ownerUsername: string
  }): Content {
    const id = randomUUID().slice(0, 8)
    const content: Content = {
      id,
      title: input.title,
      companyId: input.companyId,
      allowedUsernames: [input.ownerUsername],
      revoked: false,
      status: 'processing',
    }
    this.contents.set(id, content)
    this.persist()
    return this.clone(content)
  }

  setStatus(id: string, status: ContentStatus): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    c.status = status
    this.persist()
    return this.clone(c)
  }

  // Accès à la clé : même entreprise, non révoqué, et explicitement autorisé.
  // Le superadmin n'a AUCUN accès au contenu (companyId null => jamais autorisé) :
  // séparation stricte entre gestion de plateforme et accès aux médias.
  isAllowed(contentId: string, user: JwtUser): boolean {
    const c = this.contents.get(contentId)
    if (!c || c.revoked) return false
    if (c.companyId !== user.companyId) return false
    return c.allowedUsernames.includes(user.username)
  }

  // Supprime un contenu (son enregistrement). Les artefacts HLS/clé sont retirés
  // séparément par UploadService.deleteArtifacts. Retourne true si retiré.
  delete(id: string): boolean {
    const ok = this.contents.delete(id)
    if (ok) this.persist()
    return ok
  }

  // Supprime tous les contenus d'une entreprise (cascade à la suppression d'orga).
  deleteByCompany(companyId: string): number {
    let removed = 0
    for (const [id, c] of this.contents) {
      if (c.companyId === companyId) {
        this.contents.delete(id)
        removed++
      }
    }
    if (removed) this.persist()
    return removed
  }

  grantAccess(id: string, username: string): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    if (!c.allowedUsernames.includes(username)) c.allowedUsernames.push(username)
    this.persist()
    return this.clone(c)
  }

  revokeAccess(id: string, username: string): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    c.allowedUsernames = c.allowedUsernames.filter((u) => u !== username)
    this.persist()
    return this.clone(c)
  }

  setRevoked(id: string, revoked: boolean): Content | undefined {
    const c = this.contents.get(id)
    if (!c) return undefined
    c.revoked = revoked
    this.persist()
    return this.clone(c)
  }

  private persist(): void {
    saveJson(STORE, [...this.contents.values()])
  }

  private clone(c: Content): Content {
    return { ...c, allowedUsernames: [...c.allowedUsernames] }
  }
}
