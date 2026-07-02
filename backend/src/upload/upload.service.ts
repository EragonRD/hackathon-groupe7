import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import { mkdir, rm, writeFile, readdir, rename, stat } from 'fs/promises'
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
const CHUNKS_ROOT = join(UPLOAD_TMP, 'chunks')

// Plafond de taille TOTALE d'un upload chunké. La limite `fileSize` de multer ne
// borne QUE chaque chunk : sans ce plafond cumulatif, un client enverrait un nombre
// illimité de chunks -> fichier fusionné de taille arbitraire (DoS/disque). Aligné
// sur l'ancien /upload (1 Go).
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024
// Garde-fou anti-abus sur le nombre de morceaux (évite un totalChunks aberrant).
const MAX_CHUNKS = 4096
// Durée de vie d'un dossier de chunks inactif : au-delà, un upload jamais terminé
// (client parti) est considéré orphelin et purgé (voir sweepStaleChunks).
const CHUNK_TTL_MS = 6 * 60 * 60 * 1000 // 6 h
const CHUNK_SWEEP_MS = 60 * 60 * 1000 // balayage horaire

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

    // Ménage des uploads chunkés abandonnés : au démarrage puis périodiquement.
    // `unref()` : le timer ne maintient pas le process en vie (tests, arrêt propre).
    void this.sweepStaleChunks()
    setInterval(() => void this.sweepStaleChunks(), CHUNK_SWEEP_MS).unref()
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
      
      // Générer la miniature
      await this.runFfmpeg([
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-ss',
        '00:00:01',
        '-i',
        inputPath,
        '-vframes',
        '1',
        '-q:v',
        '2',
        join(outDir, 'thumbnail.jpg'),
      ]).catch(e => this.logger.warn(`Miniature échouée pour ${contentId}: ${e.message}`))
    } finally {
      this.releaseEncodeSlot()
      await rm(keyInfoPath, { force: true }).catch(() => {})
    }
  }

  // Stocke temporairement un morceau (chunk) de vidéo, puis le fusionne si tous sont là.
  // `ownerKey` (identité de l'appelant) ISOLE les chunks par utilisateur : deux
  // uploads ne peuvent pas se contaminer, même en cas de collision d'uploadId, et un
  // tiers ne peut pas injecter de morceaux dans l'upload d'autrui.
  async handleChunk(
    tempFilePath: string,
    chunkIndex: number,
    totalChunks: number,
    uploadId: string,
    originalname: string,
    ownerKey: string,
  ): Promise<{ completed: boolean; path?: string }> {
    // Garde-fous d'entrée AVANT toute écriture disque : sur throw, le contrôleur
    // supprime le fichier temporaire multer (encore intact ici, non renommé).
    if (!uploadId || !/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
      throw new Error('uploadId invalide')
    }
    if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) {
      throw new Error('totalChunks invalide')
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
      throw new Error('chunkIndex invalide')
    }

    const owner = ownerKey.replace(/[^a-zA-Z0-9_-]/g, '_') || 'anon'
    const chunkDir = join(CHUNKS_ROOT, owner, uploadId)
    await mkdir(chunkDir, { recursive: true })

    const chunkPath = join(chunkDir, `${chunkIndex}.part`)
    await rename(tempFilePath, chunkPath)

    // Plafond cumulatif : borne le disque à MAX_UPLOAD_BYTES (+ 1 chunk) et rejette
    // dès qu'un client tente de dépasser la limite de taille TOTALE.
    const parts = await readdir(chunkDir)
    let received = 0
    for (const p of parts) received += (await stat(join(chunkDir, p))).size
    if (received > MAX_UPLOAD_BYTES) {
      await rm(chunkDir, { recursive: true, force: true }).catch(() => {})
      throw new Error('Fichier trop volumineux')
    }

    if (parts.length !== totalChunks) return { completed: false }

    // Verrou par upload isolé : `owner/uploadId` (pas seulement uploadId).
    const mergeKey = `${owner}/${uploadId}`
    if (this.activeMerges.has(mergeKey)) return { completed: false }

    const expectedPaths = Array.from({ length: totalChunks }, (_, i) =>
      join(chunkDir, `${i}.part`),
    )
    if (!expectedPaths.every((p) => existsSync(p))) return { completed: false }

    this.activeMerges.add(mergeKey)
    const ext = extname(originalname) || '.mp4'
    const finalPath = join(UPLOAD_TMP, `${owner}-${uploadId}${ext}`)
    const writeStream = createWriteStream(finalPath)
    try {
      for (const partPath of expectedPaths) {
        await new Promise<void>((resolve, reject) => {
          const readStream = createReadStream(partPath)
          readStream.on('error', reject)
          readStream.on('end', resolve)
          readStream.pipe(writeStream, { end: false })
        })
      }
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
        writeStream.end()
      })
      await rm(chunkDir, { recursive: true, force: true }).catch(() => {})
      return { completed: true, path: finalPath }
    } catch (err) {
      // Fusion échouée : on ferme le flux et on nettoie le fichier partiel + les
      // chunks, pour ne rien laisser fuiter sur le disque.
      writeStream.destroy()
      await rm(finalPath, { force: true }).catch(() => {})
      await rm(chunkDir, { recursive: true, force: true }).catch(() => {})
      throw err
    } finally {
      this.activeMerges.delete(mergeKey)
    }
  }

  // Purge des dossiers de chunks orphelins (upload jamais terminé : client parti).
  // On se base sur la date de modification du dossier ; au-delà de CHUNK_TTL_MS,
  // on supprime. Best-effort, jamais bloquant.
  async sweepStaleChunks(): Promise<void> {
    if (!existsSync(CHUNKS_ROOT)) return
    const now = Date.now()
    let owners: string[] = []
    try {
      owners = await readdir(CHUNKS_ROOT)
    } catch {
      return
    }
    for (const owner of owners) {
      const ownerDir = join(CHUNKS_ROOT, owner)
      let uploads: string[] = []
      try {
        uploads = await readdir(ownerDir)
      } catch {
        continue
      }
      for (const uploadId of uploads) {
        const dir = join(ownerDir, uploadId)
        try {
          const info = await stat(dir)
          if (now - info.mtimeMs > CHUNK_TTL_MS) {
            await rm(dir, { recursive: true, force: true }).catch(() => {})
            this.logger.warn(`Chunks orphelins purgés : ${owner}/${uploadId}`)
          }
        } catch {
          /* dossier disparu entre-temps : rien à faire */
        }
      }
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpegPath = require('ffmpeg-static') || 'ffmpeg';
      const proc = spawn(ffmpegPath, args)
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
