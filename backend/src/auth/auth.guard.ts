import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'
import { SessionService } from './session.service'

// Protège une route : exige un JWT valide (header `Authorization: Bearer <token>`)
// et expose l'utilisateur décodé sur `req.user` — réutilisable par tous les pôles.
//   Usage :  @UseGuards(AuthGuard)  sur un contrôleur ou une route.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

    if (!token) throw new UnauthorizedException('Token manquant')

    let payload: { sub?: number; sid?: string } & Record<string, unknown>
    try {
      // payload = { sub, username, role, sid?, iat, exp }
      // Algorithme épinglé (HS256) pour bloquer toute confusion d'algorithme.
      payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] })
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré')
    }
    ;(req as Request & { user?: unknown }).user = payload

    // Mono-session : si le token porte un `sid` et qu'une session plus récente
    // existe pour ce compte, on refuse. Le motif `session_superseded` permet au
    // front d'afficher « déconnecté par une autre session » (distinct d'une
    // simple expiration). Les tokens sans `sid` (invités) ne sont pas concernés.
    if (
      typeof payload?.sub === 'number' &&
      typeof payload?.sid === 'string' &&
      !this.sessions.isCurrent(payload.sub, payload.sid)
    ) {
      throw new UnauthorizedException('session_superseded')
    }
    return true
  }
}
