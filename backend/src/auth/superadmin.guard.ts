import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { RequestWithUser } from '../common/request-context'

// Exige le rôle `superadmin` (gestion des entreprises et des admins).
// À utiliser APRÈS AuthGuard :  @UseGuards(AuthGuard, SuperAdminGuard)
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>()
    if (req.user?.role !== 'superadmin') {
      throw new ForbiddenException('Acces reserve aux super-administrateurs')
    }
    return true
  }
}
