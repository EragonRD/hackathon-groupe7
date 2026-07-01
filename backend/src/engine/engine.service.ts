import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { readFile } from 'fs/promises'

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

  // Envoie la vidéo EN CLAIR à l'Engine pour analyse → renvoie le job_id.
  async analyzeFile(filePath: string, filename = 'video.mp4'): Promise<string> {
    const buffer = await readFile(filePath)
    const form = new FormData()
    form.append('file', new Blob([buffer]), filename)
    const res = await fetch(`${ENGINE_URL}/analyze`, {
      method: 'POST',
      headers: { Authorization: await this.auth() },
      body: form,
    })
    if (!res.ok) throw new Error(`Engine /analyze a répondu ${res.status}`)
    const data = (await res.json()) as { job_id: string }
    return data.job_id
  }

  async getJob(jobId: string): Promise<EngineJob> {
    const res = await fetch(`${ENGINE_URL}/jobs/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: await this.auth() },
    })
    if (!res.ok) throw new Error(`Engine /jobs a répondu ${res.status}`)
    return (await res.json()) as EngineJob
  }

  async search(jobId: string, query: string, k: number): Promise<unknown> {
    const res = await fetch(`${ENGINE_URL}/search`, {
      method: 'POST',
      headers: { Authorization: await this.auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, query, k }),
    })
    if (!res.ok) throw new Error(`Engine /search a répondu ${res.status}`)
    return res.json()
  }
}
