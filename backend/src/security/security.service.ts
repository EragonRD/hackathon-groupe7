import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { appendFile, mkdir, readFile } from 'fs/promises'
import { dirname } from 'path'
import { backendPath } from '../common/runtime-paths'
import { loadJson, saveJson } from '../common/json-store'

const BANS_STORE = 'bans.json'
const WINDOW_MS = 5 * 60 * 1000
const ALERT_TTL_MS = 10 * 60 * 1000
const MULTI_SESSION_IP_THRESHOLD = 3
const SEGMENT_WINDOW_MS = 60 * 1000
// Seuils calibrés pour NE PAS bloquer un visionnage légitime : le HLS télécharge
// beaucoup de segments .ts (buffer d'avance + refetch au seek), et les segments
// ne portant pas de token, ils sont comptés PAR IP (plusieurs spectateurs
// derrière un même NAT partagent le compteur). On ne bloque qu'un débit
// clairement abusif (aspiration en masse), pas une lecture normale.
export const SEGMENT_ALERT_THRESHOLD = 60
export const SEGMENT_BLOCK_THRESHOLD = 120
const ALERT_DEDUPE_MS = 30 * 1000
const MAX_TRAFFIC_EVENTS = 2_000
// Capture d'écran (heuristique client) : plancher sous lequel on ignore le signal
// (bruit), et seuil au-dessus duquel l'alerte passe en action 'block' (visuel).
const CAPTURE_MIN_RISK = 40
const CAPTURE_BLOCK_RISK = 80

export type SecurityAlertType =
  'multi_session' | 'proxy_ip' | 'segment_scrape' | 'screen_capture'

// Signaux de risque de capture d'écran remontés par le client (heuristiques).
export interface CaptureSignalInput {
  account?: string | number
  username?: string
  ip: string
  contentId?: string
  session?: string
  risk: number // 0..100 (score calculé côté client, revalidé/borné ici)
  signals: string[] // ex: ['page_inactive', 'extended_display', 'devtools']
}

export interface SecurityRequestInput {
  account?: string | number
  username?: string
  ip: string
  method?: string
  path: string
  source?: 'core' | 'hls-mirror'
  tsMs?: number
}

export interface SecurityTrafficEvent {
  seq: number
  ts: string
  tsMs: number
  account?: string
  username?: string
  ip: string
  method: string
  path: string
  source: 'core' | 'hls-mirror'
}

export interface SecurityAlert {
  id: string
  ts: string
  type: SecurityAlertType
  account?: string
  username?: string
  ip: string
  detail: string
  action: 'flag' | 'block'
}

interface StoredAlert extends SecurityAlert {
  tsMs: number
}

interface ProxyNetwork {
  raw: string
  base: number
  mask: number
}

@Injectable()
export class SecurityService implements OnModuleInit {
  private readonly logger = new Logger(SecurityService.name)
  private readonly proxyListPath = backendPath('data', 'proxy-ips.txt')
  private readonly alertLogPath = backendPath('logs', 'security-alerts.log')
  private alertDirReady = false
  // IP bannies manuellement depuis le dashboard admin.
  private readonly bans = new Map<string, { reason: string; at: string }>()
  private readonly traffic: SecurityTrafficEvent[] = []
  private readonly alerts: StoredAlert[] = []
  private readonly alertDedupe = new Map<string, number>()
  private proxyNetworks: ProxyNetwork[] = []
  private nextAlertId = 1
  private eventSeq = 0

  async onModuleInit(): Promise<void> {
    await this.loadProxyList()
    // Recharge les bans persistés (survivent aux redémarrages).
    const stored = loadJson<Array<{ ip: string; reason: string; at: string }> | null>(
      BANS_STORE,
      null,
    )
    for (const b of stored ?? []) this.bans.set(b.ip, { reason: b.reason, at: b.at })
  }

  async recordRequest(input: SecurityRequestInput): Promise<{
    blocked: boolean
    alerts: SecurityAlert[]
  }> {
    // Anti-bruit : on ne compte PAS les endpoints de surveillance eux-mêmes
    // (le dashboard se poll toutes les 2 s) — sinon l'« activité récente » et les
    // compteurs se remplissent de leurs propres appels. Le contrôle de ban, lui,
    // a déjà eu lieu en amont (middleware), donc rien n'est affaibli.
    if (this.isMonitoringPath(input.path)) {
      return { blocked: false, alerts: [] }
    }

    const now = input.tsMs ?? Date.now()
    this.trim(now)

    const event: SecurityTrafficEvent = {
      seq: ++this.eventSeq,
      ts: new Date(now).toISOString(),
      tsMs: now,
      account: input.account === undefined ? undefined : String(input.account),
      username: input.username,
      ip: input.ip,
      method: input.method ?? 'GET',
      path: input.path,
      source: input.source ?? 'core',
    }

    this.traffic.push(event)
    if (this.traffic.length > MAX_TRAFFIC_EVENTS) {
      this.traffic.shift()
    }

    const alerts: SecurityAlert[] = []
    let blocked = false

    const proxyMatch = this.findProxyMatch(event.ip)
    if (proxyMatch) {
      const alert = await this.createAlert(now, {
        type: 'proxy_ip',
        account: event.account,
        username: event.username,
        ip: event.ip,
        detail: `IP presente dans la liste reputation hors-ligne (${proxyMatch})`,
        action: 'flag',
      })
      if (alert) alerts.push(alert)
    }

    if (event.account) {
      const distinctIps = this.distinctIpsForAccount(event.account, now)
      if (distinctIps.length > MULTI_SESSION_IP_THRESHOLD) {
        const alert = await this.createAlert(now, {
          type: 'multi_session',
          account: event.account,
          username: event.username,
          ip: event.ip,
          detail: `${distinctIps.length} IP distinctes sur ${WINDOW_MS / 1000}s: ${distinctIps.join(', ')}`,
          action: 'flag',
        })
        if (alert) alerts.push(alert)
      }
    }

    if (this.isSegmentRequest(event.path)) {
      const actor = event.account ?? event.ip
      const segmentCount = this.segmentRequestsForActor(actor, now).length
      const action = segmentCount > SEGMENT_BLOCK_THRESHOLD ? 'block' : 'flag'

      if (segmentCount > SEGMENT_ALERT_THRESHOLD) {
        blocked = action === 'block'
        const alert = await this.createAlert(now, {
          type: 'segment_scrape',
          account: event.account,
          username: event.username,
          ip: event.ip,
          detail: `${segmentCount} requetes .ts en ${SEGMENT_WINDOW_MS / 1000}s pour ${actor}`,
          action,
        })
        if (alert) alerts.push(alert)
      }
    }

    return { blocked, alerts }
  }

  getDashboard() {
    const now = Date.now()
    this.trim(now)

    const activeAlerts = this.alerts.map(({ tsMs: _tsMs, ...alert }) => alert)
    const recentTraffic = this.traffic
      .slice(-80)
      .map(({ tsMs: _tsMs, ...event }) => event)
    const uniqueIps = new Set(this.traffic.map((event) => event.ip))
    const accounts = new Set(
      this.traffic
        .map((event) => event.account)
        .filter((account): account is string => Boolean(account)),
    )

    return {
      generatedAt: new Date(now).toISOString(),
      thresholds: {
        rateLimit: '100 req / 60s / IP',
        slidingWindowSeconds: WINDOW_MS / 1000,
        multiSessionDistinctIps: `> ${MULTI_SESSION_IP_THRESHOLD}`,
        segmentWindowSeconds: SEGMENT_WINDOW_MS / 1000,
        segmentAlertThreshold: `> ${SEGMENT_ALERT_THRESHOLD}`,
        segmentBlockThreshold: `> ${SEGMENT_BLOCK_THRESHOLD}`,
      },
      counters: {
        recentRequests: this.traffic.length,
        activeAlerts: activeAlerts.length,
        uniqueIps: uniqueIps.size,
        accounts: accounts.size,
        proxyNetworks: this.proxyNetworks.length,
        segmentRequests: this.traffic.filter((event) => this.isSegmentRequest(event.path))
          .length,
      },
      recentTraffic,
      alerts: activeAlerts.slice(-80).reverse(),
    }
  }

  // Renvoie UNIQUEMENT ce qui a changé depuis les curseurs fournis (delta) :
  // nouvelles alertes (id > afterAlertId) et nouveau trafic (seq > afterEventSeq).
  // Le front garde les curseurs et n'ajoute que le neuf → « détecte les changements ».
  getChanges(afterEventSeq: number, afterAlertId: number) {
    const now = Date.now()
    this.trim(now)

    const newTraffic = this.traffic
      .filter((e) => e.seq > afterEventSeq)
      .slice(-100)
      .map(({ tsMs: _tsMs, ...event }) => event)
    const newAlerts = this.alerts
      .filter((a) => Number(a.id) > afterAlertId)
      .map(({ tsMs: _tsMs, ...alert }) => alert)

    const uniqueIps = new Set(this.traffic.map((event) => event.ip))
    const hasChanges = newTraffic.length > 0 || newAlerts.length > 0

    return {
      generatedAt: new Date(now).toISOString(),
      hasChanges,
      counters: {
        recentRequests: this.traffic.length,
        activeAlerts: this.alerts.length,
        uniqueIps: uniqueIps.size,
        segmentRequests: this.traffic.filter((e) => this.isSegmentRequest(e.path)).length,
      },
      newTraffic,
      newAlerts,
      // Curseurs à renvoyer au prochain appel.
      lastEventSeq: this.eventSeq,
      lastAlertId: this.nextAlertId - 1,
    }
  }

  // --- Bans d'IP (action admin depuis le dashboard) ---
  isBanned(ip: string): boolean {
    return this.bans.has(ip)
  }

  banIp(
    ip: string,
    reason: string,
    nowIso: string,
  ): { ip: string; reason: string; at: string } {
    const entry = { reason: reason || 'Banni manuellement', at: nowIso }
    this.bans.set(ip, entry)
    this.persistBans()
    this.logger.warn(`IP bannie: ${ip} (${entry.reason})`)
    return { ip, ...entry }
  }

  unbanIp(ip: string): boolean {
    const removed = this.bans.delete(ip)
    if (removed) this.persistBans()
    return removed
  }

  listBans(): Array<{ ip: string; reason: string; at: string }> {
    return [...this.bans.entries()].map(([ip, e]) => ({ ip, ...e }))
  }

  private persistBans(): void {
    saveJson(BANS_STORE, this.listBans())
  }

  private async loadProxyList(): Promise<void> {
    try {
      const content = await readFile(this.proxyListPath, 'utf8')
      this.proxyNetworks = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => this.parseProxyNetwork(line))
        .filter((network): network is ProxyNetwork => Boolean(network))
      this.logger.log(`Liste proxy chargee: ${this.proxyNetworks.length} entrees`)
    } catch {
      this.proxyNetworks = []
      this.logger.warn(`Liste proxy absente: ${this.proxyListPath}`)
    }
  }

  private distinctIpsForAccount(account: string, now: number): string[] {
    const cutoff = now - WINDOW_MS
    return [
      ...new Set(
        this.traffic
          .filter((event) => event.account === account && event.tsMs >= cutoff)
          .map((event) => event.ip),
      ),
    ]
  }

  private segmentRequestsForActor(actor: string, now: number): SecurityTrafficEvent[] {
    const cutoff = now - SEGMENT_WINDOW_MS
    return this.traffic.filter(
      (event) =>
        (event.account ?? event.ip) === actor &&
        event.tsMs >= cutoff &&
        this.isSegmentRequest(event.path),
    )
  }

  // Enregistre un signal de RISQUE de capture d'écran (heuristique remontée par le
  // client) comme alerte de sécurité — visible dans le dashboard de surveillance et
  // journalisée. Ce n'est PAS une preuve de capture (le navigateur n'en expose
  // aucune) : c'est un score de risque agrégé, à valeur dissuasive et de traçabilité.
  async recordCaptureSignal(
    input: CaptureSignalInput,
  ): Promise<SecurityAlert | undefined> {
    const now = Date.now()
    const risk = Math.max(0, Math.min(100, Math.round(Number(input.risk) || 0)))
    // Sous le plancher : bruit, on ignore pour ne pas inonder le dashboard.
    if (risk < CAPTURE_MIN_RISK) return undefined
    const signals = (input.signals ?? []).slice(0, 8).map((s) => String(s).slice(0, 40))
    const where = input.contentId ? ` sur "${String(input.contentId).slice(0, 60)}"` : ''
    return this.createAlert(now, {
      type: 'screen_capture',
      account: input.account !== undefined ? String(input.account) : undefined,
      username: input.username,
      ip: input.ip,
      detail: `Risque capture ${risk}/100${where} [${signals.join(', ') || 'n/a'}]`,
      action: risk >= CAPTURE_BLOCK_RISK ? 'block' : 'flag',
    })
  }

  private async createAlert(
    now: number,
    alert: Omit<SecurityAlert, 'id' | 'ts'>,
  ): Promise<SecurityAlert | undefined> {
    // L'action fait partie de la clé : une escalade flag -> block ré-émet une
    // alerte au lieu d'être avalée par le dédup (sinon le blocage reste invisible).
    const dedupeKey = `${alert.type}:${alert.account ?? '-'}:${alert.ip}:${alert.action}`
    const lastAlertAt = this.alertDedupe.get(dedupeKey)
    if (lastAlertAt && now - lastAlertAt < ALERT_DEDUPE_MS) {
      return undefined
    }

    const stored: StoredAlert = {
      id: String(this.nextAlertId++),
      ts: new Date(now).toISOString(),
      tsMs: now,
      ...alert,
    }
    this.alerts.push(stored)
    this.alertDedupe.set(dedupeKey, now)

    const { tsMs: _tsMs, ...publicAlert } = stored
    const line = JSON.stringify(publicAlert)
    this.logger.warn(line)

    if (!this.alertDirReady) {
      await mkdir(dirname(this.alertLogPath), { recursive: true })
      this.alertDirReady = true
    }
    await appendFile(this.alertLogPath, `${line}\n`, 'utf8')

    return publicAlert
  }

  private trim(now: number): void {
    const trafficCutoff = now - WINDOW_MS
    while (this.traffic[0] && this.traffic[0].tsMs < trafficCutoff) {
      this.traffic.shift()
    }

    const alertCutoff = now - ALERT_TTL_MS
    while (this.alerts[0] && this.alerts[0].tsMs < alertCutoff) {
      this.alerts.shift()
    }
  }

  private isSegmentRequest(path: string): boolean {
    return /\.ts(?:[?#]|$)/.test(path)
  }

  // Endpoints de surveillance/admin pollés régulièrement : exclus de l'activité.
  private isMonitoringPath(path: string): boolean {
    return (
      path.startsWith('/security/dashboard') ||
      path.startsWith('/security/changes') ||
      path.startsWith('/security/watermark') ||
      path.startsWith('/security/bans') ||
      path.startsWith('/admin/audit')
    )
  }

  private findProxyMatch(ip: string): string | undefined {
    const ipNumber = this.ipv4ToNumber(ip)
    if (ipNumber === undefined) return undefined

    return this.proxyNetworks.find(
      (network) => (ipNumber & network.mask) === network.base,
    )?.raw
  }

  private parseProxyNetwork(line: string): ProxyNetwork | undefined {
    const [ip, prefixText = '32'] = line.split('/')
    const prefix = Number(prefixText)
    const ipNumber = this.ipv4ToNumber(ip)

    if (
      ipNumber === undefined ||
      !Number.isInteger(prefix) ||
      prefix < 0 ||
      prefix > 32
    ) {
      return undefined
    }

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
    return {
      raw: line,
      base: ipNumber & mask,
      mask,
    }
  }

  private ipv4ToNumber(ip: string): number | undefined {
    const normalized =
      ip.replace(/^::ffff:/, '') === '::1' ? '127.0.0.1' : ip.replace(/^::ffff:/, '')
    const parts = normalized.split('.').map((part) => Number(part))

    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return undefined
    }

    return (
      (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
    )
  }
}
