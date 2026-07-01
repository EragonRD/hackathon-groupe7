import { Controller, Get, Param, Req, Res } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import type { Response } from 'express'
import { extractClientIp } from '../common/request-context'
import type { RequestWithUser } from '../common/request-context'
import { SecurityService } from '../security/security.service'
import { StreamService } from './stream.service'

// 🎬 Diffusion HLS servie par le Core → même origine que l'API, donc joignable
// via le tunnel / le proxy front (fini le http://localhost:8080). La CLÉ reste
// protégée par /keys/:id ; ici on ne sert que le flux CHIFFRÉ.
@Controller('videos')
export class StreamController {
  constructor(
    private readonly stream: StreamService,
    private readonly security: SecurityService,
  ) {}

  @SkipThrottle()
  @Get(':contentId/index.m3u8')
  async playlist(
    @Param('contentId') contentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const body = await this.stream.getPlaylist(contentId)
    res
      .status(200)
      .setHeader('Content-Type', 'application/vnd.apple.mpegurl')
      .setHeader('Cache-Control', 'no-store')
      .send(body)
  }

  @SkipThrottle()
  @Get(':contentId/:segment')
  async segment(
    @Param('contentId') contentId: string,
    @Param('segment') segment: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const path = this.stream.resolveSegment(contentId, segment)

    // Détection anti-scraping (même moteur que l'ingest nginx) : compte les .ts.
    const result = await this.security.recordRequest({
      account: req.user?.sub,
      username: req.user?.username,
      ip: extractClientIp(req),
      method: req.method,
      path: `/videos/${contentId}/${segment}`,
      source: 'core',
    })
    if (result.blocked) {
      res
        .status(429)
        .json({ statusCode: 429, message: 'Debit de scraping suspect detecte' })
      return
    }

    res.status(200).setHeader('Content-Type', 'video/mp2t').sendFile(path)
  }
}
