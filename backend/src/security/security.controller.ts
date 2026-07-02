import {
  All,
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { SkipThrottle } from '@nestjs/throttler'
import { AuthGuard } from '../auth/auth.guard'
import { AdminGuard } from '../auth/admin.guard'
import {
  extractBearerToken,
  extractClientIp,
  isTrustedPeer,
} from '../common/request-context'
import type { JwtUser, RequestWithUser } from '../common/request-context'
import { SecurityService } from './security.service'
import { SecuritySelftestService } from './selftest.service'

@Controller('security')
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly jwt: JwtService,
    private readonly selftest: SecuritySelftestService,
  ) {}

  // Dashboard protégé : réservé à un administrateur (le tableau expose comptes + IP).
  @SkipThrottle()
  @UseGuards(AuthGuard, AdminGuard)
  @Get('dashboard')
  dashboard() {
    return this.security.getDashboard()
  }

  // Surveillance incrémentale : ne renvoie QUE les changements depuis les curseurs.
  //   GET /security/changes?afterEvent=<seq>&afterAlert=<id>
  @SkipThrottle()
  @UseGuards(AuthGuard, AdminGuard)
  @Get('changes')
  changes(
    @Query('afterEvent') afterEvent?: string,
    @Query('afterAlert') afterAlert?: string,
  ) {
    const seq = Number(afterEvent)
    const alertId = Number(afterAlert)
    return this.security.getChanges(
      Number.isFinite(seq) ? seq : 0,
      Number.isFinite(alertId) ? alertId : 0,
    )
  }

  // Auto-test : rejoue les 4 scénarios d'attaque en self-HTTP (loopback) et
  // renvoie PASS/FAIL par scénario. Réservé admin (déclenche des alertes réelles).
  @SkipThrottle()
  @UseGuards(AuthGuard, AdminGuard)
  @Post('selftest')
  runSelftest() {
    return this.selftest.run()
  }

  // --- Bans d'IP (admin) ---
  @SkipThrottle()
  @UseGuards(AuthGuard, AdminGuard)
  @Get('bans')
  listBans() {
    return this.security.listBans()
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Post('ban')
  banIp(@Body() body: { ip?: string; reason?: string }) {
    const ip = body?.ip?.trim()
    if (!ip) throw new BadRequestException('ip requise')
    return this.security.banIp(ip, body.reason ?? '', new Date().toISOString())
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Delete('ban/:ip')
  unbanIp(@Param('ip') ip: string) {
    return { ip, removed: this.security.unbanIp(ip) }
  }

  @UseGuards(AuthGuard)
  @Get('watermark')
  watermark(@Req() req: RequestWithUser) {
    const user = req.user!
    const timestamp = new Date().toISOString()

    return {
      label: `${user.username}#${user.sub} ${timestamp}`,
      username: user.username,
      sub: user.sub,
      ts: timestamp,
    }
  }

  // Remontée d'un signal de risque de capture d'écran (heuristique client).
  // Authentifié : on rattache l'alerte à l'utilisateur + son IP (traçabilité).
  @SkipThrottle()
  @UseGuards(AuthGuard)
  @Post('capture-report')
  @HttpCode(204)
  async captureReport(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      contentId?: string
      session?: string
      risk?: number
      signals?: string[]
    },
  ): Promise<void> {
    const user = req.user!
    await this.security.recordCaptureSignal({
      account: user.sub,
      username: user.username,
      ip: extractClientIp(req),
      contentId: body?.contentId,
      session: body?.session,
      risk: Number(body?.risk) || 0,
      signals: Array.isArray(body?.signals) ? body.signals : [],
    })
  }

  @SkipThrottle()
  @All('ingest')
  @HttpCode(204)
  async ingest(@Req() req: RequestWithUser): Promise<void> {
    // Endpoint interne : appelé par nginx (auth_request) ou le loopback.
    // Un client externe direct ne doit pas pouvoir polluer la détection.
    if (!isTrustedPeer(req)) {
      throw new ForbiddenException('Endpoint interne')
    }

    const user = req.user ?? (await this.verifyTokenIfPresent(req))
    const originalPath = this.header(req, 'x-original-uri') ?? req.originalUrl

    const result = await this.security.recordRequest({
      account: user?.sub,
      username: user?.username,
      ip: extractClientIp(req),
      method: req.method,
      path: originalPath,
      source: 'hls-mirror',
    })

    // Utilisé par nginx en `auth_request` : un 403 ici fait refuser le segment
    // par nginx. C'est ce qui rend le blocage du scraping RÉEL (pas seulement
    // une alerte), puisque les segments .ts sont servis par nginx.
    if (result.blocked) {
      throw new ForbiddenException('Debit de scraping suspect : segment refuse')
    }
  }

  private async verifyTokenIfPresent(req: RequestWithUser): Promise<JwtUser | undefined> {
    const token = extractBearerToken(req)
    if (!token) return undefined

    try {
      return await this.jwt.verifyAsync<JwtUser>(token)
    } catch {
      return undefined
    }
  }

  private header(req: RequestWithUser, name: string): string | undefined {
    const value = req.headers[name]
    if (Array.isArray(value)) return value[0]
    return value
  }
}
