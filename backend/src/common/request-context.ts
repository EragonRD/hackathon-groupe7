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
  // `req.ip` respecte la configuration `trust proxy` posée dans main.ts :
  // X-Forwarded-For n'est honoré que s'il provient d'un proxy de confiance.
  // Un client direct non fiable ne peut donc pas usurper son IP.
  return req.ip || req.socket.remoteAddress || 'unknown'
}
