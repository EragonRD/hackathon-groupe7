import { Injectable, Logger } from '@nestjs/common'
import { loadJson, saveJson } from '../common/json-store'
import { EngineService } from './engine.service'

export type AnalysisStatus = 'not_analyzed' | 'processing' | 'done' | 'error'

export interface AnalysisRecord {
  contentId: string
  jobId?: string
  status: AnalysisStatus
  result?: unknown
  error?: string
  updatedAt: string
}

const STORE = 'analysis.json'
const POLL_MS = 2000
const POLL_DEADLINE_MS = 15 * 60 * 1000 // au-delà, on abandonne (statut error)

// Pont entre le Core et l'Engine : mémorise `contentId → { jobId, status, result }`
// (persisté), déclenche l'analyse UNE FOIS par contenu, et poll l'Engine en tâche
// de fond. Le front ne voit jamais de job_id — il interroge par contentId.
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name)
  private readonly records = new Map<string, AnalysisRecord>()

  constructor(private readonly engine: EngineService) {
    const stored = loadJson<AnalysisRecord[] | null>(STORE, null) ?? []
    for (const r of stored) this.records.set(r.contentId, r)
    // Reprend le polling des analyses restées « processing » après un redémarrage.
    for (const r of this.records.values()) {
      if (r.status === 'processing' && r.jobId)
        this.poll(r.contentId, r.jobId, Date.now())
    }
  }

  get(contentId: string): AnalysisRecord | undefined {
    return this.records.get(contentId)
  }

  // Déclenche l'analyse depuis le fichier CLAIR (à l'ingestion — la vidéo n'est pas
  // encore chiffrée). Idempotent : ne relance pas si déjà `done`/`processing`.
  startFromFile(contentId: string, filePath: string): void {
    const existing = this.records.get(contentId)
    if (existing && (existing.status === 'done' || existing.status === 'processing'))
      return
    this.set(contentId, { status: 'processing' })
    void this.engine
      .analyzeFile(filePath)
      .then((jobId) => {
        this.set(contentId, { status: 'processing', jobId })
        this.poll(contentId, jobId, Date.now())
      })
      .catch((e: unknown) => {
        this.set(contentId, {
          status: 'error',
          error: `Engine indisponible : ${(e as Error).message}`,
        })
      })
  }

  async search(contentId: string, query: string, k: number): Promise<unknown> {
    const rec = this.records.get(contentId)
    if (!rec?.jobId || rec.status !== 'done') return null
    return this.engine.search(rec.jobId, query, k)
  }

  private poll(contentId: string, jobId: string, startedAt: number): void {
    const tick = (): void => {
      void this.engine
        .getJob(jobId)
        .then((job) => {
          if (job.status === 'done') {
            this.set(contentId, { status: 'done', jobId, result: job.result })
            this.logger.log(`Analyse ${contentId} terminée`)
            return
          }
          if (job.status === 'error') {
            this.set(contentId, {
              status: 'error',
              jobId,
              error: job.error ?? 'analyse échouée',
            })
            return
          }
          if (Date.now() - startedAt > POLL_DEADLINE_MS) {
            this.set(contentId, {
              status: 'error',
              jobId,
              error: 'délai d’analyse dépassé',
            })
            return
          }
          setTimeout(tick, POLL_MS)
        })
        .catch(() => {
          // Engine momentanément injoignable : on retente, dans la limite du délai.
          if (Date.now() - startedAt <= POLL_DEADLINE_MS) setTimeout(tick, POLL_MS * 2)
          else
            this.set(contentId, { status: 'error', jobId, error: 'Engine injoignable' })
        })
    }
    setTimeout(tick, POLL_MS)
  }

  private set(contentId: string, patch: Partial<AnalysisRecord>): void {
    const prev = this.records.get(contentId)
    const rec: AnalysisRecord = {
      status: 'not_analyzed',
      ...prev,
      ...patch,
      contentId,
      updatedAt: new Date().toISOString(),
    }
    this.records.set(contentId, rec)
    saveJson(STORE, [...this.records.values()])
  }
}
