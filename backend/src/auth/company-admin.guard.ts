import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { RequestWithUser } from '../common/request-context'

// Exige STRICTEMENT le rôle `admin` d'entreprise (le superadmin est EXCLU).
// Le superadmin gère la plateforme (entreprises, rôles, comptes) mais n'a
// AUCUN accès au contenu : les routes de contenu passent par ce guard.
// À utiliser après AuthGuard :  @UseGuards(AuthGuard, CompanyAdminGuard)
@Injectable()
export class CompanyAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithUser>()
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException("Acces reserve aux administrateurs d'entreprise")
    }
    return true
  }
}
