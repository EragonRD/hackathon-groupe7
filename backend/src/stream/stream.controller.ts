import { Controller, Get, Param, Res } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import type { Response } from 'express'
import { StreamService } from './stream.service'

// 🎬 Diffusion HLS servie par le Core → même origine que l'API, donc joignable
// via le tunnel / le proxy front (fini le http://localhost:8080). La CLÉ reste
// protégée par /keys/:id ; ici on ne sert que le flux CHIFFRÉ.
//
// ⚠️ La détection anti-scraping (comptage des .ts) est déjà faite par le
// SecurityMiddleware global (qui bloque en 429 avant d'atteindre ce contrôleur) :
// on NE recompte PAS ici, sinon chaque segment serait compté deux fois et une
// lecture normale finirait bloquée à mi-course.
@Controller('videos')
export class StreamController {
  constructor(private readonly stream: StreamService) {}

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
  @Get(':contentId/thumbnail.jpg')
  thumbnail(
    @Param('contentId') contentId: string,
    @Res() res: Response,
  ): void {
    const path = this.stream.resolveSegment(contentId, 'thumbnail.jpg')
    res.status(200).setHeader('Content-Type', 'image/jpeg').sendFile(path)
  }

  @SkipThrottle()
  @Get(':contentId/:segment')
  segment(
    @Param('contentId') contentId: string,
    @Param('segment') segment: string,
    @Res() res: Response,
  ): void {
    const path = this.stream.resolveSegment(contentId, segment)
    res.status(200).setHeader('Content-Type', 'video/mp2t').sendFile(path)
  }
}
