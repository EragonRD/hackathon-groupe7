import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { RequestWithUser } from '../common/request-context'

// Exige le rôle `admin` OU `superadmin` (un superadmin a tous les droits d'admin).
// À utiliser APRÈS AuthGuard (qui peuple `req.user`) :
//   @UseGuards(AuthGuard, AdminGuard)
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>()
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      throw new ForbiddenException('Acces reserve aux administrateurs')
    }
    return true
  }
}
