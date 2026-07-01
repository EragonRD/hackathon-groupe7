import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { backendPath } from '../common/runtime-paths'
import { ContentsService } from '../contents/contents.service'

// Même résolution que StreamService : le Core lit et écrit le HLS au même endroit.
function resolveHlsDir(): string {
  if (process.env.HLS_DIR) return process.env.HLS_DIR
  const cwd = process.cwd()
  for (const p of [join(cwd, 'media', 'hls'), join(cwd, '..', 'media', 'hls')]) {
    if (existsSync(p)) return p
  }
  return join(cwd, 'media', 'hls')
}

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name)
  private readonly hlsDir = resolveHlsDir()
  private readonly secretsDir = backendPath('secrets')

  constructor(private readonly contents: ContentsService) {}

  // Réconciliation au démarrage : un chiffrement interrompu par un arrêt du Core
  // (jobs en mémoire, non repris) laisse le contenu bloqué en 'processing' pour
  // toujours -> spinner infini côté front. On rattrape : si le HLS est complet
  // (index.m3u8 écrit en dernier par ffmpeg) -> 'ready', sinon -> 'failed' (donc
  // l'utilisateur voit l'échec et peut ré-uploader).
  onModuleInit(): void {
    for (const c of this.contents.list()) {
      if (c.status !== 'processing') continue
      const done = existsSync(join(this.hlsDir, c.id, 'index.m3u8'))
      this.contents.setStatus(c.id, done ? 'ready' : 'failed')
      this.logger.warn(
        `Réconciliation démarrage : ${c.id} 'processing' -> '${done ? 'ready' : 'failed'}'`,
      )
    }
  }

  // Lance le chiffrement en TÂCHE DE FOND (ne bloque pas la requête d'upload) :
  // met le contenu en `ready` / `failed` et nettoie le fichier temporaire.
  encryptInBackground(contentId: string, inputPath: string): void {
    void this.encrypt(contentId, inputPath)
      .then(() => {
        this.contents.setStatus(contentId, 'ready')
        this.logger.log(`Contenu ${contentId} chiffré → prêt`)
      })
      .catch((e: unknown) => {
        this.contents.setStatus(contentId, 'failed')
        this.logger.error(`Échec chiffrement ${contentId} : ${(e as Error).message}`)
      })
      .finally(() => {
        void rm(inputPath, { force: true }).catch(() => {})
      })
  }

  // Chiffre la vidéo en HLS AES-128 (clé + IV par contenu). Ré-encode en H.264/AAC
  // pour garantir un flux lisible par hls.js quel que soit le fichier source.
  private async encrypt(contentId: string, inputPath: string): Promise<void> {
    const outDir = join(this.hlsDir, contentId)
    await mkdir(outDir, { recursive: true })
    await mkdir(this.secretsDir, { recursive: true })

    const keyPath = join(this.secretsDir, `${contentId}.key`)
    await writeFile(keyPath, randomBytes(16))
    const iv = randomBytes(16).toString('hex')

    // key_info : ligne 1 = URI dans la playlist (relative → même origine),
    //            ligne 2 = chemin de la clé lu par ffmpeg, ligne 3 = IV.
    const keyInfoPath = join(outDir, 'key_info')
    await writeFile(keyInfoPath, `/keys/${contentId}\n${keyPath}\n${iv}\n`)

    try {
      await this.runFfmpeg([
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-hls_key_info_file',
        keyInfoPath,
        '-hls_time',
        '4',
        '-hls_playlist_type',
        'vod',
        join(outDir, 'index.m3u8'),
      ])
    } finally {
      await rm(keyInfoPath, { force: true }).catch(() => {})
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args)
      let stderr = ''
      proc.stderr.on('data', (d: Buffer) => {
        stderr += d.toString()
      })
      proc.on('error', (err) =>
        reject(new Error(`ffmpeg introuvable ou illisible : ${err.message}`)),
      )
      proc.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`ffmpeg code ${code} : ${stderr.slice(-400)}`)),
      )
    })
  }
}
