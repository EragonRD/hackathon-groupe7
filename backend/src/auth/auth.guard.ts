import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'

// Protège une route : exige un JWT valide (header `Authorization: Bearer <token>`)
// et expose l'utilisateur décodé sur `req.user` — réutilisable par tous les pôles.
//   Usage :  @UseGuards(AuthGuard)  sur un contrôleur ou une route.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>()
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

    if (!token) throw new UnauthorizedException('Token manquant')

    try {
      // payload = { sub, username, role, iat, exp }
      // Algorithme épinglé (HS256) pour bloquer toute confusion d'algorithme.
      ;(req as Request & { user?: unknown }).user = await this.jwt.verifyAsync(token, {
        algorithms: ['HS256'],
      })
      return true
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré')
    }
  }
}
