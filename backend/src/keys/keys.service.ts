import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { appendFile, mkdir, readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { backendPath } from '../common/runtime-paths'
import { JwtUser } from '../common/request-context'

const CONTENT_ACL: Record<string, string[]> = {
  poc: ['alice', 'bob', 'carol'],
}

// Identifiant de contenu autorisé : empêche toute traversée de chemin
// (ex. "../../secret") dans la construction du chemin de la clé.
const CONTENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

interface KeyAccessContext {
  ip: string
}

@Injectable()
export class KeysService {
  private readonly logger = new Logger(KeysService.name)
  private readonly secretsDir = backendPath('secrets')
  private readonly logPath = backendPath('logs', 'key-access.log')

  async getKey(
    contentId: string,
    user: JwtUser,
    context: KeyAccessContext,
  ): Promise<Buffer> {
    // 1. Validation stricte de l'identifiant AVANT toute construction de chemin.
    if (!CONTENT_ID_PATTERN.test(contentId)) {
      await this.logAccess({
        user,
        contentId,
        ip: context.ip,
        granted: false,
        reason: 'invalid_content_id',
      })
      throw new NotFoundException('Cle de contenu introuvable')
    }

    // 2. Contrôle d'accès AVANT de lire le moindre fichier (refus par défaut).
    const allowedUsers = CONTENT_ACL[contentId] ?? []
    if (!allowedUsers.includes(user.username)) {
      await this.logAccess({
        user,
        contentId,
        ip: context.ip,
        granted: false,
        reason: 'content_acl_denied',
      })
      throw new ForbiddenException('Acces refuse pour ce contenu')
    }

    // 3. Seulement maintenant : lecture de la clé.
    const keyPath = join(this.secretsDir, `${contentId}.key`)
    let key: Buffer
    try {
      key = await readFile(keyPath)
    } catch {
      await this.logAccess({
        user,
        contentId,
        ip: context.ip,
        granted: false,
        reason: 'key_not_found',
      })
      throw new NotFoundException('Cle de contenu introuvable')
    }

    await this.logAccess({
      user,
      contentId,
      ip: context.ip,
      granted: true,
      reason: 'content_acl_granted',
    })

    return key
  }

  private async logAccess(entry: {
    user: JwtUser
    contentId: string
    ip: string
    granted: boolean
    reason: string
  }): Promise<void> {
    const record = {
      ts: new Date().toISOString(),
      user: entry.user.username,
      sub: entry.user.sub,
      contentId: entry.contentId,
      ip: entry.ip,
      result: entry.granted ? 'granted' : 'denied',
      reason: entry.reason,
    }

    const line = JSON.stringify(record)
    if (entry.granted) {
      this.logger.log(line)
    } else {
      this.logger.warn(line)
    }

    await mkdir(dirname(this.logPath), { recursive: true })
    await appendFile(this.logPath, `${line}\n`, 'utf8')
  }
}
