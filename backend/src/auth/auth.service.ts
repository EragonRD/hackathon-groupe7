import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { UsersService } from './users.service'

// Anti-bruteforce : au-delà de MAX_FAILS échecs, le compte est verrouillé
// temporairement (LOCK_MS). Complète le rate-limit par IP posé sur la route.
const MAX_FAILS = 5
const LOCK_MS = 5 * 60 * 1000

@Injectable()
export class AuthService {
  // Suivi en mémoire des tentatives échouées par compte.
  private readonly attempts = new Map<string, { fails: number; lockedUntil: number }>()

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  // Vérifie les identifiants puis émet un JWT court qui identifiera l'utilisateur
  // sur toutes les requêtes suivantes.
  async login(username: string, password: string) {
    const now = Date.now()
    const record = this.attempts.get(username)

    // Compte verrouillé : on refuse sans même tester le mot de passe.
    if (record && record.lockedUntil > now) {
      throw new HttpException(
        'Compte temporairement verrouille apres trop de tentatives',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const user = await this.users.findByUsername(username)
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      this.registerFailure(username, now)
      throw new UnauthorizedException('Identifiants invalides')
    }

    // Succès : on remet le compteur à zéro.
    this.attempts.delete(username)

    const payload = { sub: user.id, username: user.username, role: user.role }
    const accessToken = await this.jwt.signAsync(payload)

    return {
      accessToken,
      user: { id: user.id, username: user.username, role: user.role },
    }
  }

  private registerFailure(username: string, now: number): void {
    const record = this.attempts.get(username) ?? { fails: 0, lockedUntil: 0 }
    record.fails += 1
    if (record.fails >= MAX_FAILS) {
      record.lockedUntil = now + LOCK_MS
      record.fails = 0
    }
    this.attempts.set(username, record)
  }
}
