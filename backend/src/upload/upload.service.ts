import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import { mkdir, rm, writeFile, readdir, rename } from 'fs/promises'
import { extname, join } from 'path'
import { tmpdir } from 'os'
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

// Chiffrement HLS = ré-encodage libx264 (très CPU). On borne le nombre de jobs
// ffmpeg SIMULTANÉS : sans ça, N uploads en parallèle lancent N ffmpeg et
// saturent le CPU (voire l'OOM), ralentissant tout le service. File d'attente FIFO.
// Validation stricte : une valeur absente/invalide/<=0 (ex: "0", "abc", NaN)
// retomberait sur 0 ou NaN et gèlerait TOUS les encodages à vie. On plancher à 1.
function parseMaxEncodes(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}
const MAX_CONCURRENT_ENCODES = parseMaxEncodes(process.env.MAX_CONCURRENT_ENCODES)
const UPLOAD_TMP = join(tmpdir(), 'poulpium-uploads')

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name)
  private readonly hlsDir = resolveHlsDir()
  private readonly secretsDir = backendPath('secrets')

  // Sémaphore de concurrence ffmpeg : jetons disponibles + file de réveils en attente.
  private encodeSlots = MAX_CONCURRENT_ENCODES
  private readonly encodeQueue: Array<() => void> = []
  private readonly activeMerges = new Set<string>()

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

  // Acquiert un jeton (attend si tous les slots ffmpeg sont pris).
  private acquireEncodeSlot(): Promise<void> {
    if (this.encodeSlots > 0) {
      this.encodeSlots -= 1
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => this.encodeQueue.push(resolve))
  }

  // Rend le jeton et réveille le prochain job en attente, s'il y en a un.
  private releaseEncodeSlot(): void {
    const next = this.encodeQueue.shift()
    if (next) next()
    else this.encodeSlots += 1
  }

  // Lance le chiffrement en TÂCHE DE FOND (ne bloque pas la requête d'upload) :
  // met le contenu en `ready` / `failed`. La suppression du fichier temporaire
  // clair est coordonnée par l'appelant (contrôleur), APRÈS que l'Engine l'a aussi
  // lu — d'où la promesse renvoyée. On n'efface donc PAS le fichier ici.
  encryptInBackground(contentId: string, inputPath: string): Promise<void> {
    return this.encrypt(contentId, inputPath)
      .then(() => {
        this.contents.setStatus(contentId, 'ready')
        this.logger.log(`Contenu ${contentId} chiffré → prêt`)
      })
      .catch((e: unknown) => {
        this.contents.setStatus(contentId, 'failed')
        this.logger.error(`Échec chiffrement ${contentId} : ${(e as Error).message}`)
      })
  }

  // Supprime les artefacts d'un contenu : rendu HLS chiffré + clé AES.
  // Best-effort (le contenu peut n'avoir jamais été chiffré).
  async deleteArtifacts(contentId: string): Promise<void> {
    await rm(join(this.hlsDir, contentId), { recursive: true, force: true }).catch(
      () => {},
    )
    await rm(join(this.secretsDir, `${contentId}.key`), { force: true }).catch(() => {})
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

    // Attend un slot libre avant de lancer le ré-encodage (borne la charge CPU).
    await this.acquireEncodeSlot()
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
      this.releaseEncodeSlot()
      await rm(keyInfoPath, { force: true }).catch(() => {})
    }
  }

  // Stocke temporairement un morceau (chunk) de vidéo, puis le fusionne si tous sont là.
  async handleChunk(
    tempFilePath: string,
    chunkIndex: number,
    totalChunks: number,
    uploadId: string,
    originalname: string,
  ): Promise<{ completed: boolean; path?: string }> {
    if (!uploadId || !/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
      throw new Error('uploadId invalide')
    }

    const chunkDir = join(UPLOAD_TMP, 'chunks', uploadId)
    await mkdir(chunkDir, { recursive: true })

    const chunkPath = join(chunkDir, `${chunkIndex}.part`)
    await rename(tempFilePath, chunkPath)

    const files = await readdir(chunkDir)
    if (files.length === totalChunks) {
      if (this.activeMerges.has(uploadId)) {
        return { completed: false }
      }
      const expectedPaths = Array.from({ length: totalChunks }, (_, i) =>
        join(chunkDir, `${i}.part`),
      )
      const allExist = expectedPaths.every((p) => existsSync(p))
      if (allExist) {
        this.activeMerges.add(uploadId)
        try {
          const ext = extname(originalname) || '.mp4'
          const finalPath = join(UPLOAD_TMP, `${uploadId}${ext}`)
          const writeStream = createWriteStream(finalPath)

          for (const partPath of expectedPaths) {
            await new Promise<void>((resolve, reject) => {
              const readStream = createReadStream(partPath)
              readStream.pipe(writeStream, { end: false })
              readStream.on('end', resolve)
              readStream.on('error', reject)
            })
          }
          writeStream.end()

          await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve)
            writeStream.on('error', reject)
          })

          await rm(chunkDir, { recursive: true, force: true }).catch(() => {})

          return { completed: true, path: finalPath }
        } finally {
          this.activeMerges.delete(uploadId)
        }
      }
    }

    return { completed: false }
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
