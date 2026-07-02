import { spawn, spawnSync } from 'child_process'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

// Résolution ffmpeg autonome (même stratégie que UploadService, dupliquée ici
// pour éviter une dépendance circulaire EngineModule <-> UploadModule) :
// 1) binaire SYSTÈME (garanti en prod : Dockerfile `apk add ffmpeg`),
// 2) repli sur le paquet npm `ffmpeg-static` (dev sans ffmpeg système).
let cachedFfmpeg: string | null = null

// Plafond d'exécution ffmpeg (extraction audio). Généreux (l'extraction audio
// seule est rapide, même sur une longue vidéo) mais BORNÉ : au-delà, on considère
// le process gelé et on le tue, pour ne jamais laisser l'analyse coincée.
const FFMPEG_TIMEOUT_MS = 3 * 60 * 1000 // 5 min

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
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    // Garde-fou anti-blocage : un ffmpeg qui GÈLE (fichier malformé, flux HLS qui
    // stalle) ne se termine jamais -> sans ça, la Promise ne se résout pas et
    // l'analyse reste « processing » à vie. On tue le process au-delà du délai.
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      done(() =>
        reject(
          new Error(`extraction audio ffmpeg: délai dépassé (${FFMPEG_TIMEOUT_MS} ms)`),
        ),
      )
    }, FFMPEG_TIMEOUT_MS)
    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    proc.on('error', (e) =>
      done(() => reject(new Error(`ffmpeg introuvable : ${e.message}`))),
    )
    proc.on('close', (code) =>
      done(() =>
        code === 0
          ? resolve()
          : reject(
            new Error(`extraction audio ffmpeg (code ${code}) : ${stderr.slice(-300)}`),
          ),
      ),
    )
  })

  return out
}
