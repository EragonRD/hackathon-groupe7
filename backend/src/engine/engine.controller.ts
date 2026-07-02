import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { AuthGuard } from '../auth/auth.guard'
import { PasswordChangedGuard } from '../auth/password-changed.guard'
import { ContentsService } from '../contents/contents.service'
import type { JwtUser, RequestWithUser } from '../common/request-context'
import { AnalysisService } from './analysis.service'

// Métadonnées IA par contentId (le front ne voit jamais de job_id). Protégé par
// la MÊME ACL que /keys et /contents : un utilisateur ne lit que les métadonnées
// d'un contenu de SON entreprise auquel il a accès.
@UseGuards(AuthGuard, PasswordChangedGuard)
@Controller('contents')
export class EngineController {
  constructor(
    private readonly contents: ContentsService,
    private readonly analysis: AnalysisService,
  ) {}

  @Get(':id/metadata')
  metadata(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertAccess(id, req.user!)
    const rec = this.analysis.get(id)
    if (!rec || rec.status === 'not_analyzed') {
      res.status(404)
      return { status: 'not_analyzed' }
    }
    if (rec.status === 'processing') {
      res.status(202)
      return { status: 'processing' }
    }
    if (rec.status === 'error') {
      res.status(409)
      return { status: 'error', error: rec.error }
    }
    return rec.result // 200 : VideoMetadata (contrat P3-A)
  }

  @Post(':id/search')
  async search(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { query?: string; k?: number },
  ) {
    this.assertAccess(id, req.user!)
    if (!body?.query) throw new BadRequestException('query requise')
    const rec = this.analysis.get(id)
    if (!rec || rec.status !== 'done') {
      throw new ConflictException("L'analyse de ce contenu n'est pas terminée")
    }
    return this.analysis.search(id, body.query, body.k ?? 3)
  }

  // Traduction À LA DEMANDE d'une langue (test temps réel côté front).
  @Post(':id/translate')
  async translate(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { lang?: string },
  ) {
    this.assertAccess(id, req.user!)
    if (!body?.lang) throw new BadRequestException('lang requise')
    const rec = this.analysis.get(id)
    if (!rec || rec.status !== 'done') {
      throw new ConflictException("L'analyse de ce contenu n'est pas terminée")
    }
    return this.analysis.translate(id, body.lang)
  }

  // ACL identique à /keys : contenu existant, même entreprise, accès explicite.
  private assertAccess(id: string, user: JwtUser): void {
    const content = this.contents.find(id)
    // Cross-tenant / inexistant : 404 (on ne révèle rien).
    if (!content || content.companyId !== user.companyId) {
      throw new NotFoundException('Contenu introuvable')
    }
    if (!this.contents.isAllowed(id, user)) {
      throw new ForbiddenException('Accès refusé pour ce contenu')
    }
  }
}
