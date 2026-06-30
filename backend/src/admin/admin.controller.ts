import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { AdminGuard } from '../auth/admin.guard'
import { UsersService } from '../auth/users.service'
import { ContentsService } from '../contents/contents.service'

// 🛡️ Back-office — toutes les routes exigent un JWT valide ET le rôle admin.
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly contents: ContentsService,
  ) {}

  // Liste des utilisateurs (sans hash).
  @Get('users')
  listUsers() {
    return this.users.listUsers()
  }

  // Catalogue des contenus + droits + état de révocation.
  @Get('contents')
  listContents() {
    return this.contents.list()
  }

  // Donner l'accès d'un utilisateur à un contenu.
  @Post('contents/:id/access')
  grantAccess(@Param('id') id: string, @Body() body: { username?: string }) {
    const username = body?.username
    if (!username) throw new BadRequestException('username requis')
    if (!this.users.exists(username)) throw new NotFoundException('Utilisateur inconnu')
    const content = this.contents.grantAccess(id, username)
    if (!content) throw new NotFoundException('Contenu inconnu')
    return content
  }

  // Retirer l'accès d'un utilisateur à un contenu.
  @Delete('contents/:id/access/:username')
  revokeAccess(@Param('id') id: string, @Param('username') username: string) {
    const content = this.contents.revokeAccess(id, username)
    if (!content) throw new NotFoundException('Contenu inconnu')
    return content
  }

  // 🔒 Révoquer la clé : la délivrance est bloquée immédiatement (403 sur /keys).
  @Post('contents/:id/revoke')
  revokeKey(@Param('id') id: string) {
    const content = this.contents.setRevoked(id, true)
    if (!content) throw new NotFoundException('Contenu inconnu')
    return { ...content, message: 'Cle revoquee : delivrance bloquee' }
  }

  // Rétablir la délivrance de la clé.
  @Post('contents/:id/restore')
  restoreKey(@Param('id') id: string) {
    const content = this.contents.setRevoked(id, false)
    if (!content) throw new NotFoundException('Contenu inconnu')
    return { ...content, message: 'Delivrance retablie' }
  }
}
