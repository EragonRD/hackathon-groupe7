import { All, Controller, Get, HttpCode, Req, UseGuards } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { SkipThrottle } from '@nestjs/throttler'
import { AuthGuard } from '../auth/auth.guard'
import { extractBearerToken, extractClientIp } from '../common/request-context'
import type { JwtUser, RequestWithUser } from '../common/request-context'
import { SecurityService } from './security.service'

@Controller('security')
export class SecurityController {
  constructor(
    private readonly security: SecurityService,
    private readonly jwt: JwtService,
  ) {}

  @SkipThrottle()
  @Get('dashboard')
  dashboard() {
    return this.security.getDashboard()
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

  @SkipThrottle()
  @All('ingest')
  @HttpCode(204)
  async ingest(@Req() req: RequestWithUser): Promise<void> {
    const user = req.user ?? (await this.verifyTokenIfPresent(req))
    const originalPath = this.header(req, 'x-original-uri') ?? req.originalUrl

    await this.security.recordRequest({
      account: user?.sub,
      username: user?.username,
      ip: extractClientIp(req),
      method: req.method,
      path: originalPath,
      source: 'hls-mirror',
    })
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
