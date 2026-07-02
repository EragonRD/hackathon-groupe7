import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { openAsBlob } from 'fs'
import { rm } from 'fs/promises'
import { audioTempDir, extractAudioMp3 } from './ffmpeg-audio'

const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:8000'

export interface EngineJob {
  status: 'processing' | 'done' | 'error'
  result?: unknown
  error?: string
  output_dir?: string
}

// Client bas-niveau vers l'Engine (FastAPI). Le Core signe un token de SERVICE
// avec le JWT_SECRET partagé (HS256) — l'Engine ignore `sub`. Cela découple les
// appels Core→Engine de la durée de vie du token utilisateur (analyse ~ minutes).
@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name)

  constructor(private readonly jwt: JwtService) {}

  private async auth(): Promise<string> {
    const token = await this.jwt.signAsync({
      sub: 0,
      username: 'core-service',
      role: 'service',
    })
    return `Bearer ${token}`
  }

  // Wrapper fetch : fetch() ne rejette QUE sur erreur réseau (connexion refusée,
  // DNS, service éteint), jamais sur un statut HTTP. On traduit donc ce rejet en
  // message clair « hors ligne » plutôt qu'un « fetch failed » cryptique.
  private async call(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(`${ENGINE_URL}${path}`, init)
    } catch {
      throw new Error(
        `service d'analyse IA hors ligne (Engine injoignable sur ${ENGINE_URL})`,
      )
    }
  }

  // Envoie la vidéo EN CLAIR à l'Engine pour analyse → renvoie le job_id.
  // `filename` = vrai nom du fichier (affiché dans la transcription) ;
  // `contentId` = clé de cache UNIQUE côté Engine (deux uploads distincts ne se
  // partagent jamais le même cache, même si les noms de fichier sont identiques).
  async analyzeFile(filePath: string, filename = 'video.mp4', contentId = ''): Promise<string> {
    // L'Engine n'analyse QUE l'audio (transcription -> NLP ; aucune image n'est
    // utilisée). On extrait donc une piste audio compressée et on envoie CELLE-CI
    // (~100x plus légère qu'une vidéo pouvant atteindre 1 Go) : cela élimine le
    // HTTP 413 derrière un proxy à limite de taille, et accélère le transfert.
    // Le vrai nom de fichier est conservé pour l'affichage (l'Engine sonde le
    // CONTENU, pas l'extension, donc l'audio est lu correctement).
    const audioPath = await extractAudioMp3(filePath)
    try {
      const blob = await openAsBlob(audioPath)
      const form = new FormData()
      form.append('file', blob, filename)
      if (contentId) form.append('content_id', contentId)
      const res = await this.call('/analyze', {
        method: 'POST',
        headers: { Authorization: await this.auth() },
        body: form,
      })
      if (!res.ok)
        throw new Error(`service d'analyse IA en erreur (HTTP ${res.status} sur /analyze)`)
      const data = (await res.json()) as { job_id: string }
      return data.job_id
    } finally {
      await rm(audioTempDir(audioPath), { recursive: true, force: true }).catch(() => {})
    }
  }

  async getJob(jobId: string): Promise<EngineJob> {
    const res = await this.call(`/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: await this.auth() },
    })
    if (!res.ok)
      throw new Error(`service d'analyse IA en erreur (HTTP ${res.status} sur /jobs)`)
    return (await res.json()) as EngineJob
  }

  async search(jobId: string, query: string, k: number): Promise<unknown> {
    const res = await this.call('/search', {
      method: 'POST',
      headers: { Authorization: await this.auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, query, k }),
    })
    if (!res.ok)
      throw new Error(`service d'analyse IA en erreur (HTTP ${res.status} sur /search)`)
    return res.json()
  }

  // Traduction À LA DEMANDE d'une langue (réutilise les segments déjà analysés).
  async translate(jobId: string, lang: string): Promise<unknown> {
    const res = await this.call('/translate', {
      method: 'POST',
      headers: { Authorization: await this.auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, lang }),
    })
    if (res.status === 422)
      throw new Error(`traduction indisponible pour la langue « ${lang} »`)
    if (!res.ok)
      throw new Error(`service d'analyse IA en erreur (HTTP ${res.status} sur /translate)`)
    return res.json()
  }
}
