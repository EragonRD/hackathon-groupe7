import { Injectable, OnModuleInit } from '@nestjs/common'
import * as argon2 from 'argon2'

// 3 niveaux : superadmin (global) · admin (lié à une entreprise) · user (lié à une entreprise).
export type Role = 'superadmin' | 'admin' | 'user'

export interface User {
  id: number
  username: string
  role: Role
  companyId: string | null // null pour un superadmin (global)
  passwordHash: string
}

export interface PublicUser {
  id: number
  username: string
  role: Role
  companyId: string | null
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
        role: u.role,
        companyId: u.companyId,
        passwordHash: await argon2.hash(u.password),
      })),
    )
  }

  findByUsername(username: string): Promise<User | undefined> {
    return Promise.resolve(this.users.find((u) => u.username === username))
  }

  exists(username: string): boolean {
    return this.users.some((u) => u.username === username)
  }

  // Création d'un compte (par un admin ou un superadmin). Hash Argon2.
  async createUser(input: {
    username: string
    password: string
    role: Role
    companyId: string | null
  }): Promise<PublicUser> {
    const user: User = {
      id: this.nextId++,
      username: input.username,
      role: input.role,
      companyId: input.companyId,
      passwordHash: await argon2.hash(input.password),
    }
    this.users.push(user)
    return this.toPublic(user)
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
    return { id: u.id, username: u.username, role: u.role, companyId: u.companyId }
  }
}
