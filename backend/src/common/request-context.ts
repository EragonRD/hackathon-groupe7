import type { Request } from 'express'

export interface JwtUser {
  sub: string | number
  username: string
  role?: string
  iat?: number
  exp?: number
}

export type RequestWithUser = Request & { user?: JwtUser }

export function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined
}

export function extractClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for']
  const firstForwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor

  if (firstForwardedIp) {
    return firstForwardedIp.split(',')[0]?.trim() || 'unknown'
  }

  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim()
  }

  return req.ip || req.socket.remoteAddress || 'unknown'
}
