import { Injectable, OnModuleInit } from '@nestjs/common'
import * as argon2 from 'argon2'

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
    return this.toPublic(user)
  }

  // Changement de mot de passe : efface le caractère temporaire et le flag.
  async changePassword(username: string, newPassword: string): Promise<void> {
    const user = this.users.find((u) => u.username === username)
    if (!user) return
    user.passwordHash = await argon2.hash(newPassword)
    user.mustChangePassword = false
    user.passwordExpiresAt = null
  }

  listAll(): PublicUser[] {
    return this.users.map((u) => this.toPublic(u))
  }

  listByCompany(companyId: string | null): PublicUser[] {
    return this.users
      .filter((u) => u.companyId === companyId)
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
