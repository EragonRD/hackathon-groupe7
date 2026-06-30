import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { AuthGuard } from '../auth/auth.guard'
import { extractClientIp } from '../common/request-context'
import type { RequestWithUser } from '../common/request-context'
import { KeysService } from './keys.service'

@Controller('keys')
export class KeysController {
  constructor(private readonly keys: KeysService) {}

  @UseGuards(AuthGuard)
  @Get(':contentId')
  async getKey(
    @Param('contentId') contentId: string,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const key = await this.keys.getKey(contentId, req.user!, {
      ip: extractClientIp(req),
    })

    res
      .status(200)
      .setHeader('Content-Type', 'application/octet-stream')
      .setHeader('Cache-Control', 'no-store')
      .setHeader('Content-Length', key.length)
      .send(key)
  }
}
