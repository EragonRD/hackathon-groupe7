import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomBytes } from 'crypto'
import * as argon2 from 'argon2'
import { UsersService } from './users.service'

// Anti-bruteforce : au-delà de MAX_FAILS échecs, le COUPLE (IP, compte) est
// verrouillé temporairement (LOCK_MS). Clé par IP+username pour qu'un attaquant
// ne puisse pas verrouiller la victime depuis une autre IP. Complète le rate-limit.
const MAX_FAILS = 5
const LOCK_MS = 5 * 60 * 1000
// Borne mémoire : au-delà, on purge les entrées expirées (anti-OOM si spray d'usernames).
const MAX_ATTEMPT_ENTRIES = 10_000

// Verrou AGRÉGÉ par compte (toutes IP confondues) : bloque le brute-force
// DISTRIBUÉ (botnet, rotation d'IP) que le verrou par couple (IP, compte) laisse
// passer. Seuil plus haut pour ne pas permettre un déni de service trivial d'un
// compte tiers ; verrou plus court. Un login réussi remet ce compteur à zéro.
const ACCOUNT_MAX_FAILS = 25
const ACCOUNT_LOCK_MS = 15 * 60 * 1000

// Refresh tokens : durée de vie et store révocable (vrai logout).
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

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

  // Compteur agrégé par compte (clé = username) pour le brute-force distribué.
  private readonly accountAttempts = new Map<
    string,
    { fails: number; lockedUntil: number; ts: number }
  >()

  // Store des refresh tokens (révocables) : token opaque -> session.
  private readonly refreshTokens = new Map<
    string,
    { username: string; sub: number; expiresAt: number }
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
    const accountRecord = this.accountAttempts.get(username)

    // Couple (IP, compte) OU compte (toutes IP) verrouillé : on refuse sans même
    // tester le mot de passe. Le 2e verrou attrape le brute-force distribué.
    if (
      (record && record.lockedUntil > now) ||
      (accountRecord && accountRecord.lockedUntil > now)
    ) {
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
      this.registerAccountFailure(username, now)
      throw new UnauthorizedException('Identifiants invalides')
    }

    // Mot de passe temporaire d'invitation expiré (> 24 h) : on refuse l'accès.
    if (user.passwordExpiresAt !== null && now > user.passwordExpiresAt) {
      throw new UnauthorizedException(
        'Mot de passe temporaire expiré, demandez une nouvelle invitation',
      )
    }

    // Succès : on remet les compteurs à zéro (couple ET compte).
    this.attempts.delete(key)
    this.accountAttempts.delete(username)
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

  // Rafraîchit l'access token depuis un refresh token valide (avec rotation).
  async refresh(refreshToken: string) {
    const now = Date.now()
    const record = this.refreshTokens.get(refreshToken)
    if (!record || record.expiresAt < now) {
      if (record) this.refreshTokens.delete(refreshToken)
      throw new UnauthorizedException('Refresh token invalide ou expiré')
    }
    const user = await this.users.findByUsername(record.username)
    if (!user) {
      this.refreshTokens.delete(refreshToken)
      throw new UnauthorizedException('Compte introuvable')
    }
    // Rotation : l'ancien refresh est invalidé, un nouveau est émis.
    this.refreshTokens.delete(refreshToken)
    return this.issueSession(user)
  }

  // Vrai logout : révoque le refresh token (il ne pourra plus émettre d'access token).
  logout(refreshToken: string): void {
    this.refreshTokens.delete(refreshToken)
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
    const refreshToken = this.createRefreshToken(user.id, user.username)
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        companyId: user.companyId,
        mustChangePassword: user.mustChangePassword,
      },
    }
  }

  private createRefreshToken(sub: number, username: string): string {
    const now = Date.now()
    // purge opportuniste des tokens expirés
    if (this.refreshTokens.size > 10_000) {
      for (const [t, r] of this.refreshTokens)
        if (r.expiresAt < now) this.refreshTokens.delete(t)
    }
    const token = randomBytes(32).toString('base64url')
    this.refreshTokens.set(token, { sub, username, expiresAt: now + REFRESH_TTL_MS })
    return token
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

  // Incrémente le compteur AGRÉGÉ par compte (anti-brute-force distribué).
  private registerAccountFailure(username: string, now: number): void {
    this.pruneAccountAttempts(now)
    const record = this.accountAttempts.get(username) ?? {
      fails: 0,
      lockedUntil: 0,
      ts: now,
    }
    record.fails += 1
    record.ts = now
    if (record.fails >= ACCOUNT_MAX_FAILS) {
      record.lockedUntil = now + ACCOUNT_LOCK_MS
      record.fails = 0
    }
    this.accountAttempts.set(username, record)
  }

  // Borne la mémoire : purge les entrées dont le verrou et l'activité sont expirés.
  private pruneAttempts(now: number): void {
    if (this.attempts.size < MAX_ATTEMPT_ENTRIES) return
    for (const [k, r] of this.attempts) {
      if (r.lockedUntil < now && now - r.ts > LOCK_MS) this.attempts.delete(k)
    }
  }

  private pruneAccountAttempts(now: number): void {
    if (this.accountAttempts.size < MAX_ATTEMPT_ENTRIES) return
    for (const [k, r] of this.accountAttempts) {
      if (r.lockedUntil < now && now - r.ts > ACCOUNT_LOCK_MS)
        this.accountAttempts.delete(k)
    }
  }
}
