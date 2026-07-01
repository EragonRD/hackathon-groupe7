import type { Request } from 'express'

export interface JwtUser {
  sub: string | number
  username: string
  role?: 'superadmin' | 'admin' | 'user' | 'guest'
  companyId?: string | null
  mustChangePassword?: boolean
  // Tokens INVITÉ (role 'guest') : portée limitée à un contenu + une session,
  // sans compte. `exp` (posé par signAsync) borne la durée de validité.
  contentId?: string
  session?: string
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

// Vrai si le PAIR RÉSEAU DIRECT (pas X-Forwarded-For) est loopback ou une adresse
// privée : sert à réserver les endpoints internes (ex. /security/ingest) au
// reverse-proxy (nginx) ou au loopback, et à les fermer à un client externe direct.
export function isTrustedPeer(req: Request): boolean {
  const peer = (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '')
  return (
    peer === '127.0.0.1' ||
    peer === '::1' ||
    peer.startsWith('10.') ||
    peer.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(peer) ||
    /^f[cd]/i.test(peer) // fc00::/7 (ULA IPv6)
  )
}
