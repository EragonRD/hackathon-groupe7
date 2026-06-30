import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { RequestWithUser } from '../common/request-context'

// Bloque l'accès tant que l'utilisateur n'a pas changé son mot de passe temporaire.
// À utiliser APRÈS AuthGuard. La route /auth/change-password n'en dépend PAS,
// pour qu'un admin invité puisse justement poser son mot de passe.
@Injectable()
export class PasswordChangedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>()
    if (req.user?.mustChangePassword) {
      throw new ForbiddenException(
        'Changez votre mot de passe temporaire avant d’accéder au panel',
      )
    }
    return true
  }
}
