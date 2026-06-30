import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<Buffer> {
    const key = await this.keys.getKey(contentId, req.user!, {
      ip: extractClientIp(req),
    })

    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Length', key.length)

    return key
  }
}
