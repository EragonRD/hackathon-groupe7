import { Injectable, OnModuleInit } from '@nestjs/common'
import * as argon2 from 'argon2'
import { loadJson, saveJson } from '../common/json-store'

const STORE = 'users.json'

// 3 niveaux : superadmin (global) · admin (lié à une entreprise) · user (lié à une entreprise).
export type Role = 'superadmin' | 'admin' | 'user'

export interface User {
  id: number
  username: string
  email: string | null
  role: Role
  companyId: string | null // null pour un superadmin (global)
  passwordHash: string
  mustChangePassword: boolean
  passwordExpiresAt: number | null // époque ms — pour un mot de passe temporaire d'invitation
}

export interface PublicUser {
  id: number
  username: string
  email: string | null
  role: Role
  companyId: string | null
  mustChangePassword: boolean
}

// ⚠️ Comptes de DÉMO. Les mots de passe en clair ne sont là QUE pour le hackathon.
const SEED: Array<{
  username: string
  password: string
  role: Role
  companyId: string | null
}> = [
  { username: 'root', password: 'password', role: 'superadmin', companyId: null },
  { username: 'alice', password: 'password', role: 'admin', companyId: 'demo' },
  { username: 'bob', password: 'password', role: 'user', companyId: 'demo' },
  { username: 'carol', password: 'password', role: 'user', companyId: 'demo' },
]

@Injectable()
export class UsersService implements OnModuleInit {
  private users: User[] = []
  private nextId = 1

  async onModuleInit(): Promise<void> {
    // Charge le disque (backend/data/users.json) s'il existe : les comptes créés
    // et les mots de passe changés survivent au redémarrage. Sinon (premier
    // lancement), on sème les comptes de démo (mots de passe hachés) et on persiste.
    const stored = loadJson<User[] | null>(STORE, null)
    if (stored && stored.length > 0) {
      this.users = stored
      this.nextId = Math.max(...stored.map((u) => u.id)) + 1
    } else {
      this.users = await Promise.all(
        SEED.map(async (u) => ({
          id: this.nextId++,
          username: u.username,
          email: null,
          role: u.role,
          companyId: u.companyId,
          passwordHash: await argon2.hash(u.password),
          mustChangePassword: false,
          passwordExpiresAt: null,
        })),
      )
      this.persist()
    }
    // Garantie anti-verrouillage : le superadmin 'root' doit TOUJOURS exister,
    // même si le fichier sur disque l'a perdu (suppression manuelle, etc.).
    await this.ensureRoot()
  }

  // Recrée 'root' (superadmin, mot de passe 'password') s'il a disparu du disque.
  private async ensureRoot(): Promise<void> {
    if (this.users.some((u) => u.username === 'root' && u.role === 'superadmin')) {
      return
    }
    this.users.push({
      id: this.nextId++,
      username: 'root',
      email: null,
      role: 'superadmin',
      companyId: null,
      passwordHash: await argon2.hash('password'),
      mustChangePassword: false,
      passwordExpiresAt: null,
    })
    this.persist()
  }

  private persist(): void {
    saveJson(STORE, this.users)
  }

  findByUsername(username: string): Promise<User | undefined> {
    return Promise.resolve(this.users.find((u) => u.username === username))
  }

  exists(username: string): boolean {
    return this.users.some((u) => u.username === username)
  }

  // Création d'un compte standard (par un admin / superadmin).
  async createUser(input: {
    username: string
    password: string
    role: Role
    companyId: string | null
  }): Promise<PublicUser> {
    const user: User = {
      id: this.nextId++,
      username: input.username,
      email: null,
      role: input.role,
      companyId: input.companyId,
      passwordHash: await argon2.hash(input.password),
      mustChangePassword: false,
      passwordExpiresAt: null,
    }
    this.users.push(user)
    this.persist()
    return this.toPublic(user)
  }

  // Invitation d'un ADMIN d'entreprise : mot de passe TEMPORAIRE + changement forcé.
  async createInvitedAdmin(input: {
    email: string
    companyId: string
    tempPassword: string
    expiresAt: number
  }): Promise<PublicUser> {
    const user: User = {
      id: this.nextId++,
      username: input.email, // l'email sert d'identifiant de connexion
      email: input.email,
      role: 'admin',
      companyId: input.companyId,
      passwordHash: await argon2.hash(input.tempPassword),
      mustChangePassword: true,
      passwordExpiresAt: input.expiresAt,
    }
    this.users.push(user)
    this.persist()
    return this.toPublic(user)
  }

  // Changement de mot de passe : efface le caractère temporaire et le flag.
  async changePassword(username: string, newPassword: string): Promise<void> {
    const user = this.users.find((u) => u.username === username)
    if (!user) return
    user.passwordHash = await argon2.hash(newPassword)
    user.mustChangePassword = false
    user.passwordExpiresAt = null
    this.persist()
  }

  // Change le rôle d'un compte entre 'admin' et 'user' (jamais 'superadmin').
  // Réservé au superadmin. Retourne le compte public à jour, ou undefined.
  setRole(username: string, role: 'admin' | 'user'): PublicUser | undefined {
    const user = this.users.find((u) => u.username === username)
    if (!user) return undefined
    user.role = role
    this.persist()
    return this.toPublic(user)
  }

  // Supprime un compte par identifiant. Retourne true si un compte a été retiré.
  deleteUser(username: string): boolean {
    const before = this.users.length
    this.users = this.users.filter((u) => u.username !== username)
    const removed = this.users.length < before
    if (removed) this.persist()
    return removed
  }

  // Supprime tous les comptes d'une entreprise (cascade à la suppression d'orga).
  deleteByCompany(companyId: string): number {
    const before = this.users.length
    this.users = this.users.filter((u) => u.companyId !== companyId)
    const removed = before - this.users.length
    if (removed) this.persist()
    return removed
  }

  listAll(): PublicUser[] {
    return this.users.map((u) => this.toPublic(u))
  }

  listByCompany(companyId: string | null): PublicUser[] {
    return this.users
      .filter((u) => u.companyId === companyId)
      .map((u) => this.toPublic(u))
  }

  // Recherche SCOPÉE au tenant de l'appelant (isolation multi-tenant) :
  // - superadmin : cherche dans tous les tenants ;
  // - admin/user : uniquement dans SA propre entreprise (companyId).
  search(query: string, caller: { role: Role; companyId: string | null }): PublicUser[] {
    const q = query.toLowerCase()
    return this.users
      .filter((u) => caller.role === 'superadmin' || u.companyId === caller.companyId)
      .filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q),
      )
      .map((u) => this.toPublic(u))
  }

  private toPublic(u: User): PublicUser {
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      companyId: u.companyId,
      mustChangePassword: u.mustChangePassword,
    }
  }
}
