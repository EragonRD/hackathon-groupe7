import { Injectable, NotFoundException } from '@nestjs/common'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Identifiants sûrs (anti path-traversal).
const CONTENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const SEGMENT_PATTERN = /^[a-zA-Z0-9._-]{1,80}\.(ts|jpg)$/

// Dossier des rendus HLS. Configurable pour le déploiement (volume monté).
function resolveHlsDir(): string {
  if (process.env.HLS_DIR) return process.env.HLS_DIR
  const cwd = process.cwd()
  for (const p of [join(cwd, 'media', 'hls'), join(cwd, '..', 'media', 'hls')]) {
    if (existsSync(p)) return p
  }
  return join(cwd, 'media', 'hls')
}

@Injectable()
export class StreamService {
  private readonly hlsDir = resolveHlsDir()

  isValidContentId(contentId: string): boolean {
    return CONTENT_ID_PATTERN.test(contentId)
  }

  // Lit la playlist et RÉÉCRIT l'URI de clé en RELATIF (`/keys/:id`) pour que le
  // lecteur la demande sur le même domaine (fonctionne via le tunnel / le proxy front).
  async getPlaylist(contentId: string): Promise<string> {
    if (!CONTENT_ID_PATTERN.test(contentId))
      throw new NotFoundException('Contenu introuvable')
    const path = join(this.hlsDir, contentId, 'index.m3u8')
    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch {
      throw new NotFoundException('Playlist introuvable')
    }
    // Remplace l'URI de la balise EXT-X-KEY par une route relative du Core.
    return raw.replace(/(#EXT-X-KEY:[^\n]*URI=")([^"]*)(")/g, `$1/keys/${contentId}$3`)
  }

  // Chemin absolu d'un segment .ts, validé (empêche toute traversée).
  resolveSegment(contentId: string, segment: string): string {
    if (!CONTENT_ID_PATTERN.test(contentId) || !SEGMENT_PATTERN.test(segment)) {
      throw new NotFoundException('Segment introuvable')
    }
    const path = join(this.hlsDir, contentId, segment)
    if (!existsSync(path)) throw new NotFoundException('Segment introuvable')
    return path
  }
}
