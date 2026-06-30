import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { UsersService } from './users.service'

// Anti-bruteforce : au-delà de MAX_FAILS échecs, le COUPLE (IP, compte) est
// verrouillé temporairement (LOCK_MS). Clé par IP+username pour qu'un attaquant
// ne puisse pas verrouiller la victime depuis une autre IP. Complète le rate-limit.
const MAX_FAILS = 5
const LOCK_MS = 5 * 60 * 1000
// Borne mémoire : au-delà, on purge les entrées expirées (anti-OOM si spray d'usernames).
const MAX_ATTEMPT_ENTRIES = 10_000

// Hash Argon2 « leurre » : sert à vérifier un mot de passe même pour un compte
// inexistant, afin d'égaliser le temps de réponse (anti-énumération d'utilisateurs).
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$d7Of2744Y0ddrMcUZWuEAw$2lak1N3gbiislK4GamY0sgedBJYxicaGbYVMSwUZBis'

@Injectable()
export class AuthService {
  // Suivi en mémoire des tentatives échouées par couple (IP, compte).
  private readonly attempts = new Map<
    string,
    { fails: number; lockedUntil: number; ts: number }
  >()

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  // Vérifie les identifiants puis émet un JWT court qui identifiera l'utilisateur
  // sur toutes les requêtes suivantes.
  async login(username: string, password: string, ip = 'unknown') {
    const now = Date.now()
    const key = `${ip}|${username}`
    const record = this.attempts.get(key)

    // Couple (IP, compte) verrouillé : on refuse sans même tester le mot de passe.
    if (record && record.lockedUntil > now) {
      throw new HttpException(
        'Trop de tentatives, reessayez plus tard',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    // On vérifie TOUJOURS un hash (réel ou leurre) : temps constant, pas de fuite
    // permettant de distinguer « compte inexistant » de « mauvais mot de passe ».
    const user = await this.users.findByUsername(username)
    const passwordOk = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password)
    if (!user || !passwordOk) {
      this.registerFailure(key, now)
      throw new UnauthorizedException('Identifiants invalides')
    }

    // Mot de passe temporaire d'invitation expiré (> 24 h) : on refuse l'accès.
    if (user.passwordExpiresAt !== null && now > user.passwordExpiresAt) {
      throw new UnauthorizedException(
        'Mot de passe temporaire expiré, demandez une nouvelle invitation',
      )
    }

    // Succès : on remet le compteur à zéro pour ce couple.
    this.attempts.delete(key)
    return this.issueSession(user)
  }

  // Change le mot de passe (depuis un compte connecté), efface le caractère
  // temporaire, et renvoie un nouveau token (sans le flag mustChangePassword).
  async changePassword(username: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findByUsername(username)
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('Mot de passe actuel invalide')
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit faire au moins 8 caractères',
      )
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent')
    }
    await this.users.changePassword(username, newPassword)
    const updated = await this.users.findByUsername(username)
    return this.issueSession(updated!)
  }

  private async issueSession(user: {
    id: number
    username: string
    role: 'superadmin' | 'admin' | 'user'
    companyId: string | null
    mustChangePassword: boolean
  }) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
      mustChangePassword: user.mustChangePassword,
    }
    const accessToken = await this.jwt.signAsync(payload)
    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
        mustChangePassword: user.mustChangePassword,
      },
    }
  }

  private registerFailure(key: string, now: number): void {
    this.pruneAttempts(now)
    const record = this.attempts.get(key) ?? { fails: 0, lockedUntil: 0, ts: now }
    record.fails += 1
    record.ts = now
    if (record.fails >= MAX_FAILS) {
      record.lockedUntil = now + LOCK_MS
      record.fails = 0
    }
    this.attempts.set(key, record)
  }

  // Borne la mémoire : purge les entrées dont le verrou et l'activité sont expirés.
  private pruneAttempts(now: number): void {
    if (this.attempts.size < MAX_ATTEMPT_ENTRIES) return
    for (const [k, r] of this.attempts) {
      if (r.lockedUntil < now && now - r.ts > LOCK_MS) this.attempts.delete(k)
    }
  }
}
