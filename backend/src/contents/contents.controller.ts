import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { StringValue } from 'ms'
import { existsSync } from 'fs'
import { AuthGuard } from '../auth/auth.guard'
import { PasswordChangedGuard } from '../auth/password-changed.guard'
import { ContentsService } from './contents.service'
import { backendPath } from '../common/runtime-paths'
import type { RequestWithUser } from '../common/request-context'

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'
// Durées d'invitation autorisées -> millisecondes (pour calculer expiresAt).
const TTL_MS: Record<string, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
}

// Catalogue côté utilisateur (distinct du back-office /admin/contents). Chaque
// utilisateur ne voit que les contenus de SON entreprise auxquels il a accès ;
// un superadmin (sans entreprise) n'a aucun contenu, cohérent avec la séparation
// gestion de plateforme / accès aux médias.
@UseGuards(AuthGuard, PasswordChangedGuard)
@Controller('contents')
export class ContentsController {
  constructor(
    private readonly contents: ContentsService,
    private readonly jwt: JwtService,
  ) {}

  @Get()
  listMine(@Req() req: RequestWithUser) {
    return this.contents.listForUser(req.user!).map((c) => ({
      id: c.id,
      title: c.title,
      revoked: c.revoked,
      guestUpload: c.guestUpload ?? false, // vidéo déposée par un invité -> badge UI
      // 'playable' = une clé AES est provisionnée pour ce contenu ET il n'est pas
      // révoqué. Le flux HLS n'est pas vérifiable depuis le Core ; la présence de
      // la clé (backend/secrets/<id>.key) est le signal fiable côté serveur.
      playable: !c.revoked && existsSync(backendPath('secrets', `${c.id}.key`)),
    }))
  }

  // Génère un LIEN D'INVITÉ temporaire pour un contenu. Réservé à un membre
  // AUTORISÉ sur ce contenu (pas un superadmin, pas une autre entreprise). Le
  // token invité est un JWT court (role 'guest') scopé au contenu + à la session,
  // signé au même secret : la clé AES (/keys/:id) et la room temps réel
  // l'accepteront jusqu'à expiration, puis l'accès cesse tout seul.
  @Post(':id/invite')
  async invite(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { ttl?: string },
  ) {
    const content = this.contents.find(id)
    if (!content) throw new NotFoundException('Contenu inconnu')
    if (!this.contents.isAllowed(id, req.user!)) {
      throw new ForbiddenException("Vous n'avez pas accès à ce contenu")
    }
    const ttl = body?.ttl
    if (!ttl || !(ttl in TTL_MS)) {
      throw new BadRequestException("ttl doit valoir '15m', '1h' ou '24h'")
    }
    // Token invité : pas de compte, portée = ce contenu + cette session (= id).
    const token = await this.jwt.signAsync(
      {
        sub: 'guest',
        username: 'guest',
        role: 'guest',
        contentId: id,
        session: id,
        companyId: content.companyId,
        // Qui a invité : sert à donner accès à ce membre (et aux admins de son
        // entreprise) si l'invité téléverse une vidéo pendant la session.
        invitedBy: req.user!.username,
      },
      { expiresIn: ttl as StringValue },
    )
    return {
      token,
      shareUrl: `${APP_URL}/?guest=${token}`,
      expiresAt: Date.now() + TTL_MS[ttl],
    }
  }
}
