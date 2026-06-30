import { Injectable, OnModuleInit } from '@nestjs/common'
import * as argon2 from 'argon2'

export type Role = 'admin' | 'member'

export interface User {
  id: number
  username: string
  role: Role
  passwordHash: string
}

// ⚠️ Comptes de DÉMO. Les mots de passe en clair ne sont là QUE pour le hackathon :
//    en vrai, on stocke uniquement les hash (pas de mot de passe en clair nulle part).
//    Ceci est un point de départ — ajoutez une vraie inscription / base de données si
//    vous le souhaitez (ce n'est pas l'objet de la note).
const SEED: Array<{ username: string; password: string; role: Role }> = [
  { username: 'alice', password: 'password', role: 'admin' },
  { username: 'bob', password: 'password', role: 'member' },
  { username: 'carol', password: 'password', role: 'member' },
]

@Injectable()
export class UsersService implements OnModuleInit {
  private users: User[] = []

  // Au démarrage, on hash les mots de passe de démo avec Argon2 (comme le produit réel).
  async onModuleInit(): Promise<void> {
    this.users = await Promise.all(
      SEED.map(async (u, i) => ({
        id: i + 1,
        username: u.username,
        role: u.role,
        passwordHash: await argon2.hash(u.password),
      })),
    )
  }

  findByUsername(username: string): Promise<User | undefined> {
    return Promise.resolve(this.users.find((u) => u.username === username))
  }

  // Liste publique (sans hash de mot de passe) — pour le back-office admin.
  listUsers(): Array<{ id: number; username: string; role: Role }> {
    return this.users.map(({ id, username, role }) => ({ id, username, role }))
  }

  exists(username: string): boolean {
    return this.users.some((u) => u.username === username)
  }
}
