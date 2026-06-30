import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import type { StringValue } from 'ms'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthGuard } from './auth.guard'
import { AdminGuard } from './admin.guard'
import { UsersService } from './users.service'

const WEAK_DEFAULT_SECRET = 'dev-secret-change-me'

// 🔐 Résout le secret JWT en REFUSANT de démarrer avec un secret faible en prod :
//    un secret par défaut ou trop court = tokens forgeables (escalade admin).
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  const isProd = process.env.NODE_ENV === 'production'
  const weak = !secret || secret === WEAK_DEFAULT_SECRET || secret.length < 16

  if (weak && isProd) {
    throw new Error(
      'JWT_SECRET manquant ou trop faible en production. ' +
        'Définis un secret fort, ex: export JWT_SECRET=$(openssl rand -hex 32)',
    )
  }
  if (weak) {
    console.warn(
      '[auth] JWT_SECRET faible/par défaut — toléré en DEV uniquement, JAMAIS en prod.',
    )
  }
  return secret ?? WEAK_DEFAULT_SECRET
}

// 🔐 Brique d'IDENTITÉ partagée — point de départ, PAS l'objet de la note.
//    • P1   : identifie le collaborateur (req.user) pour la collaboration temps réel.
//    • P2-A : émet le token court qui ouvrira la clé AES (Zero-Trust, refus par défaut).
//    • P2-B : rattache chaque requête à un compte (sessions simultanées, blocage…).
//    À durcir librement : inscription, refresh tokens, rôles fins, anti-bruteforce…
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: resolveJwtSecret(),
      // Algorithme épinglé : empêche toute confusion d'algorithme (ex. alg=none).
      signOptions: {
        expiresIn: (process.env.JWT_TTL ?? '15m') as StringValue, // token volontairement court
        algorithm: 'HS256',
      },
      verifyOptions: { algorithms: ['HS256'] },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, AuthGuard, AdminGuard],
  exports: [AuthGuard, AdminGuard, UsersService, JwtModule],
})
export class AuthModule {}
