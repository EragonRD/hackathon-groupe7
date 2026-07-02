import { spawn, spawnSync } from 'child_process'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

// Résolution ffmpeg autonome (même stratégie que UploadService, dupliquée ici
// pour éviter une dépendance circulaire EngineModule <-> UploadModule) :
// 1) binaire SYSTÈME (garanti en prod : Dockerfile `apk add ffmpeg`),
// 2) repli sur le paquet npm `ffmpeg-static` (dev sans ffmpeg système).
let cachedFfmpeg: string | null = null

function probe(bin: string): boolean {
  try {
    const res = spawnSync(bin, ['-version'])
    return !res.error && res.status === 0
  } catch {
    return false
  }
}

function resolveFfmpeg(): string {
  if (cachedFfmpeg) return cachedFfmpeg
  let resolved = 'ffmpeg'
  if (!probe('ffmpeg')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const staticPath: string = require('ffmpeg-static')
      if (staticPath && probe(staticPath)) resolved = staticPath
    } catch {
      /* on garde 'ffmpeg' et on laissera l'erreur remonter à l'exécution */
    }
  }
  cachedFfmpeg = resolved
  return resolved
}

// Dossier temporaire parent d'un audio extrait, à supprimer après envoi.
export function audioTempDir(audioPath: string): string {
  return dirname(audioPath)
}

// Extrait une piste audio compressée (MP3 16 kHz mono 48 kbps) d'une vidéo OU
// d'une playlist HLS. L'Engine n'analyse QUE l'audio (`-vn`) : lui envoyer l'audio
// (~100x plus léger que la vidéo) évite le HTTP 413 derrière un proxy à limite de
// taille, et accélère fortement le transfert. `inputArgs` sert au HLS chiffré
// (protocoles/clé) et se place AVANT `-i`.
export async function extractAudioMp3(
  inputPath: string,
  inputArgs: string[] = [],
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'poulpium-audio-'))
  const out = join(dir, 'audio.mp3')
  const ffmpeg = resolveFfmpeg()
  const args = [
    ...inputArgs,
    '-i',
    inputPath,
    '-vn',
    '-ar',
    '16000',
    '-ac',
    '1',
    '-b:a',
    '48k',
    '-y',
    out,
  ]

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpeg, args)
    let stderr = ''
    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    proc.on('error', (e) => reject(new Error(`ffmpeg introuvable : ${e.message}`)))
    proc.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`extraction audio ffmpeg (code ${code}) : ${stderr.slice(-300)}`)),
    )
  })

  return out
}
