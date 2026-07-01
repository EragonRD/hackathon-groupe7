import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  PayloadTooLargeException,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { NotesService } from './notes.service'
import { ContentsService } from '../contents/contents.service'
import type { JwtUser, RequestWithUser } from '../common/request-context'

// Borne explicite de la taille du payload de notes (défense en profondeur : le
// body-parser d'Express plafonne déjà à ~100 ko, mais on ne veut PAS dépendre de
// ce défaut implicite si la limite globale est un jour relevée pour l'upload).
const MAX_NOTES_BYTES = 256 * 1024

// Persistance serveur des notes de revue, par session. Protégé par AuthGuard.
//   GET  /notes/:session   -> notes[] persistées
//   PUT  /notes/:session   { notes: [...] } -> remplace l'état de la session
@UseGuards(AuthGuard)
@Controller('notes')
export class NotesController {
  constructor(
    private readonly notes: NotesService,
    private readonly contents: ContentsService,
  ) {}

  @Get(':session')
  get(@Req() req: RequestWithUser, @Param('session') session: string): unknown[] {
    this.assertAccess(session, req.user!)
    return this.notes.get(session)
  }

  @Put(':session')
  replace(
    @Req() req: RequestWithUser,
    @Param('session') session: string,
    @Body() body: { notes?: unknown[] },
  ): { notes: unknown[] } {
    this.assertAccess(session, req.user!)
    if (!Array.isArray(body?.notes)) {
      throw new BadRequestException('notes[] requis')
    }
    if (Buffer.byteLength(JSON.stringify(body.notes)) > MAX_NOTES_BYTES) {
      throw new PayloadTooLargeException('Trop de données de notes pour cette session')
    }
    return { notes: this.notes.replace(session, body.notes) }
  }

  // Accès aux notes d'une session.
  //
  // INVITÉ (role 'guest') : TOUJOURS confiné à la portée de son token
  //   (`session` / `contentId`), que la session soit un contenu connu ou une
  //   session ad-hoc. Sans ce cadrage, un invité pourrait lire/écrire (`PUT`)
  //   les notes de n'importe quelle session ad-hoc en devinant son nom.
  //
  // COMPTE réel (user/admin/superadmin) : si la session correspond à un CONTENU
  //   connu, on applique son contrôle d'accès (membre autorisé). Sinon (session
  //   ad-hoc / vidéo locale, hors du registre de contenus), on l'admet.
  private assertAccess(session: string, user: JwtUser): void {
    if (user.role === 'guest') {
      if (user.session === session || user.contentId === session) return
      throw new ForbiddenException('Accès refusé à cette session')
    }
    const content = this.contents.find(session)
    if (!content) return
    if (!this.contents.isAllowed(session, user)) {
      throw new ForbiddenException('Accès refusé à cette session')
    }
  }
}
