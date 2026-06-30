import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { RequestWithUser } from '../common/request-context'
import { UsersService } from './users.service'

// Bloque l'accès tant que l'utilisateur n'a pas changé son mot de passe temporaire.
// On lit l'état COURANT du compte (pas le flag figé dans le JWT) : ainsi, après un
// change-password réussi, même un ancien token encore valide n'est plus bloqué.
// À utiliser APRÈS AuthGuard. La route /auth/change-password n'en dépend PAS.
@Injectable()
export class PasswordChangedGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>()
    const username = req.user?.username
    if (!username) return true // AuthGuard gère l'absence d'utilisateur

    const user = await this.users.findByUsername(username)
    if (user?.mustChangePassword) {
      throw new ForbiddenException(
        'Changez votre mot de passe temporaire avant d’accéder au panel',
      )
    }
    return true
  }
}
