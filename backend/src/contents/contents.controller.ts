import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { existsSync } from 'fs'
import { AuthGuard } from '../auth/auth.guard'
import { PasswordChangedGuard } from '../auth/password-changed.guard'
import { ContentsService } from './contents.service'
import { backendPath } from '../common/runtime-paths'
import type { RequestWithUser } from '../common/request-context'

// Catalogue côté utilisateur (distinct du back-office /admin/contents). Chaque
// utilisateur ne voit que les contenus de SON entreprise auxquels il a accès ;
// un superadmin (sans entreprise) n'a aucun contenu, cohérent avec la séparation
// gestion de plateforme / accès aux médias.
@UseGuards(AuthGuard, PasswordChangedGuard)
@Controller('contents')
export class ContentsController {
  constructor(private readonly contents: ContentsService) {}

  @Get()
  listMine(@Req() req: RequestWithUser) {
    return this.contents.listForUser(req.user!).map((c) => ({
      id: c.id,
      title: c.title,
      revoked: c.revoked,
      // 'playable' = une clé AES est provisionnée pour ce contenu ET il n'est pas
      // révoqué. Le flux HLS n'est pas vérifiable depuis le Core ; la présence de
      // la clé (backend/secrets/<id>.key) est le signal fiable côté serveur.
      playable: !c.revoked && existsSync(backendPath('secrets', `${c.id}.key`)),
    }))
  }
}
