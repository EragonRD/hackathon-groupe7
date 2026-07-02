import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { SecurityService } from './security.service'
import type { SecurityAlertType } from './security.service'

// Résultat d'un scénario rejoué (renvoyé au front pour affichage PASS/FAIL).
export interface SelftestResult {
  key: string
  label: string
  status: 'pass' | 'fail'
  detail: string
  ms: number
}

// Compte synthétique pour multi_session : plage/label neutres, clairement
// identifiables dans le dashboard, jamais un vrai utilisateur.
const TEST_ACCOUNT = { sub: 990001, username: 'selftest' }

// IP de test en plages réservées RFC 5737 (documentation) : sûres, aucun acteur
// réel visé, et 203.0.113.x est déjà dans backend/data/proxy-ips.txt.
const IP_FLOOD = '192.0.2.250'
const IP_MULTI = ['192.0.2.10', '192.0.2.11', '192.0.2.12', '192.0.2.13']
const IP_PROXY = '203.0.113.42'
const IP_SCRAPE = '192.0.2.80'

const FLOOD_MAX = 130 // > limite throttler (100/60s) pour forcer un 429
const SCRAPE_HITS = 65 // > SEGMENT_ALERT_THRESHOLD (60) pour forcer l'alerte

// Rejoue les 4 scénarios d'attaque en self-HTTP sur 127.0.0.1 : la requête part
// du loopback → TRUST_PROXY honore X-Forwarded-For → toute la chaîne de prod est
// exercée (trust-proxy + middleware + throttler), pas seulement la logique métier.
@Injectable()
export class SecuritySelftestService {
  private readonly logger = new Logger(SecuritySelftestService.name)
  private readonly base = `http://127.0.0.1:${process.env.PORT ?? 3000}`

  constructor(
    private readonly security: SecurityService,
    private readonly jwt: JwtService,
  ) {}

  async run(): Promise<{ generatedAt: string; results: SelftestResult[] }> {
    const results = [
      await this.timed('flood', 'Flood / rate-limit (429)', () => this.flood()),
      await this.timed('multi_session', 'Sessions multiples', () =>
        this.multiSession(),
      ),
      await this.timed('proxy_ip', 'IP proxy suspecte', () => this.proxyIp()),
      await this.timed('segment_scrape', 'Aspiration de segments', () =>
        this.segmentScrape(),
      ),
    ]
    return { generatedAt: new Date().toISOString(), results }
  }

  private async timed(
    key: string,
    label: string,
    fn: () => Promise<{ ok: boolean; detail: string }>,
  ): Promise<SelftestResult> {
    const started = Date.now()
    try {
      const { ok, detail } = await fn()
      return { key, label, status: ok ? 'pass' : 'fail', detail, ms: Date.now() - started }
    } catch (err) {
      this.logger.warn(`selftest ${key} erreur: ${(err as Error).message}`)
      return {
        key,
        label,
        status: 'fail',
        detail: `Erreur d'exécution: ${(err as Error).message}`,
        ms: Date.now() - started,
      }
    }
  }

  // --- Scénarios ---------------------------------------------------------

  // Flood : martèle `/` avec une IP forgée jusqu'au 429 du throttler.
  private async flood(): Promise<{ ok: boolean; detail: string }> {
    for (let i = 1; i <= FLOOD_MAX; i++) {
      const status = await this.status('/', { ip: IP_FLOOD })
      if (status === 429) {
        return { ok: true, detail: `HTTP 429 atteint à la requête ${i} (limite 100/60s)` }
      }
    }
    return { ok: false, detail: `Aucun HTTP 429 après ${FLOOD_MAX} requêtes` }
  }

  // Multi-session : même compte vu depuis 4 IP distinctes → > seuil (3).
  private async multiSession(): Promise<{ ok: boolean; detail: string }> {
    const token = await this.jwt.signAsync({
      sub: TEST_ACCOUNT.sub,
      username: TEST_ACCOUNT.username,
      role: 'user',
    })
    for (const ip of IP_MULTI) {
      await this.status('/', { ip, token })
    }
    const alert = this.findAlert('multi_session', (a) => a.account === String(TEST_ACCOUNT.sub))
    return alert
      ? { ok: true, detail: alert.detail }
      : { ok: false, detail: `Aucune alerte multi_session pour ${TEST_ACCOUNT.username}` }
  }

  // Proxy : une requête depuis une IP présente dans la liste réputation.
  private async proxyIp(): Promise<{ ok: boolean; detail: string }> {
    await this.status('/', { ip: IP_PROXY })
    const alert = this.findAlert('proxy_ip', (a) => a.ip === IP_PROXY)
    return alert
      ? { ok: true, detail: alert.detail }
      : { ok: false, detail: `Aucune alerte proxy_ip pour ${IP_PROXY}` }
  }

  // Scraping : > 60 requêtes .ts en 60 s via l'endpoint interne /security/ingest
  // (loopback = pair de confiance), comme le fait nginx en auth_request.
  private async segmentScrape(): Promise<{ ok: boolean; detail: string }> {
    for (let i = 1; i <= SCRAPE_HITS; i++) {
      const seg = `/hls/poc/seg${String(i).padStart(4, '0')}.ts`
      await this.status('/security/ingest', {
        method: 'POST',
        ip: IP_SCRAPE,
        originalUri: seg,
      })
    }
    const alert = this.findAlert('segment_scrape', (a) => a.ip === IP_SCRAPE)
    return alert
      ? { ok: true, detail: alert.detail }
      : { ok: false, detail: `Aucune alerte segment_scrape pour ${IP_SCRAPE}` }
  }

  // --- Helpers -----------------------------------------------------------

  private findAlert(
    type: SecurityAlertType,
    match: (a: { account?: string; ip: string; detail: string }) => boolean,
  ) {
    return this.security.getDashboard().alerts.find((a) => a.type === type && match(a))
  }

  private async status(
    path: string,
    opts: { method?: string; ip: string; token?: string; originalUri?: string },
  ): Promise<number> {
    const headers: Record<string, string> = { 'X-Forwarded-For': opts.ip }
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`
    if (opts.originalUri) headers['X-Original-URI'] = opts.originalUri

    const res = await fetch(`${this.base}${path}`, {
      method: opts.method ?? 'GET',
      headers,
    })
    return res.status
  }
}
