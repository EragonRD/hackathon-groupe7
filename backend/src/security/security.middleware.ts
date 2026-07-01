import { Injectable, NestMiddleware } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { NextFunction, Response } from 'express'
import { extractBearerToken, extractClientIp } from '../common/request-context'
import type { JwtUser, RequestWithUser } from '../common/request-context'
import { SecurityService } from './security.service'

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(
    private readonly security: SecurityService,
    private readonly jwt: JwtService,
  ) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction): Promise<void> {
    // IP bannie (action admin) : on coupe tout de suite.
    const ip = extractClientIp(req)
    if (this.security.isBanned(ip)) {
      res.status(403).json({ statusCode: 403, message: 'IP bannie' })
      return
    }

    const user = req.user ?? (await this.verifyTokenIfPresent(req))
    if (user && !req.user) {
      req.user = user
    }

    const result = await this.security.recordRequest({
      account: user?.sub,
      username: user?.username,
      ip: extractClientIp(req),
      method: req.method,
      path: req.originalUrl || req.url,
      source: 'core',
    })

    if (result.blocked) {
      res.status(429).json({
        statusCode: 429,
        message: 'Debit de scraping suspect detecte',
        alerts: result.alerts,
      })
      return
    }

    next()
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
}
