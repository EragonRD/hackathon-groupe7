import { appendFile, mkdir, readFile } from 'fs/promises'
import {
  SecurityService,
  SEGMENT_ALERT_THRESHOLD,
  SEGMENT_BLOCK_THRESHOLD,
} from './security.service'

jest.mock('fs/promises', () => ({
  appendFile: jest.fn(),
  mkdir: jest.fn(),
  readFile: jest.fn(),
}))

const fsMock = {
  appendFile: appendFile as jest.MockedFunction<typeof appendFile>,
  mkdir: mkdir as jest.MockedFunction<typeof mkdir>,
  readFile: readFile as jest.MockedFunction<typeof readFile>,
}

const baseRequest = {
  account: 'alice',
  username: 'Alice',
  method: 'GET',
  path: '/manifest.m3u8',
}

async function request(
  service: SecurityService,
  overrides: Partial<Parameters<SecurityService['recordRequest']>[0]>,
) {
  return service.recordRequest({
    ...baseRequest,
    ip: '203.0.113.10',
    tsMs: 1_000_000,
    ...overrides,
  })
}

describe('SecurityService', () => {
  let service: SecurityService

  beforeEach(() => {
    service = new SecurityService()
    fsMock.appendFile.mockResolvedValue(undefined)
    fsMock.mkdir.mockResolvedValue(undefined)
    fsMock.readFile.mockReset()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('alerts on the fourth distinct IP for one account, not the third', async () => {
    for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      const result = await request(service, { ip })
      expect(result.alerts).toHaveLength(0)
    }

    const result = await request(service, { ip: '198.51.100.4' })

    expect(result.alerts).toMatchObject([
      { type: 'multi_session', account: 'alice', action: 'flag' },
    ])
  })

  it('drops old IPs from the multi-session sliding window', async () => {
    for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
      await request(service, { ip, tsMs: 1_000 })
    }

    const result = await request(service, {
      ip: '198.51.100.4',
      tsMs: 1_000 + 5 * 60_000 + 1,
    })

    expect(result.alerts).toHaveLength(0)
  })

  it('escalates segment scraping from no alert to flag to block at thresholds', async () => {
    // Jusqu'au seuil d'alerte inclus : aucune alerte.
    for (let i = 1; i <= SEGMENT_ALERT_THRESHOLD; i += 1) {
      const result = await request(service, { path: `/seg-${i}.ts`, tsMs: 2_000 + i })
      expect(result.alerts).toHaveLength(0)
      expect(result.blocked).toBe(false)
    }

    // Une de plus -> flag (pas encore bloqué).
    const flag = await request(service, {
      path: `/seg-${SEGMENT_ALERT_THRESHOLD + 1}.ts`,
      tsMs: 2_000 + SEGMENT_ALERT_THRESHOLD + 1,
    })
    expect(flag).toMatchObject({
      blocked: false,
      alerts: [{ type: 'segment_scrape', action: 'flag' }],
    })

    for (let i = SEGMENT_ALERT_THRESHOLD + 2; i <= SEGMENT_BLOCK_THRESHOLD; i += 1) {
      await request(service, { path: `/seg-${i}.ts`, tsMs: 2_000 + i })
    }

    // Au-delà du seuil de blocage -> block.
    const block = await request(service, {
      path: `/seg-${SEGMENT_BLOCK_THRESHOLD + 1}.ts`,
      tsMs: 2_000 + SEGMENT_BLOCK_THRESHOLD + 1,
    })
    expect(block).toMatchObject({
      blocked: true,
      alerts: [{ type: 'segment_scrape', action: 'block' }],
    })
  })

  // Discrimine l'exclusion : SEGMENT_ALERT_THRESHOLD vraies requetes .ts (= seuil,
  // aucune alerte) PLUS des leurres (.tsx, .ts au milieu du chemin). Le bon regex
  // ne compte que les vraies -> pas d'alerte. Un regex trop large compterait les
  // leurres -> dépasserait le seuil -> alerte (le test rougirait).
  it('does not count .tsx or path-embedded .ts as segments', async () => {
    const paths: string[] = []
    for (let i = 1; i <= SEGMENT_ALERT_THRESHOLD; i += 1) paths.push(`/seg-${i}.ts`)
    paths.push('/report.tsx', '/a.ts/b') // leurres : ne doivent PAS compter
    const allAlerts = []

    for (const [index, path] of paths.entries()) {
      const result = await request(service, { path, tsMs: 5_000 + index })
      allAlerts.push(...result.alerts)
    }

    expect(allAlerts).toEqual([])
  })

  // Discrimine l'inverse : ?query et #fragment apres .ts comptent bien.
  // (seuil - 1) .ts simples + 1 ".ts?token" + 1 ".ts#frag" = seuil + 1 -> flag.
  // Un regex en /\.ts$/ raterait les suffixes -> pas d'alerte (le test rougirait).
  it('counts .ts URLs with a query or fragment suffix', async () => {
    const paths: string[] = []
    for (let i = 1; i <= SEGMENT_ALERT_THRESHOLD - 1; i += 1) paths.push(`/seg-${i}.ts`)
    paths.push('/segA.ts?token=x', '/segB.ts#frag')
    let latest: Awaited<ReturnType<SecurityService['recordRequest']>> | undefined

    for (const [index, path] of paths.entries()) {
      latest = await request(service, { path, tsMs: 5_000 + index })
    }

    expect(latest).toMatchObject({
      blocked: false,
      alerts: [{ type: 'segment_scrape', action: 'flag' }],
    })
  })

  it('tracks anonymous segment scraping by IP when no account is present', async () => {
    let latest: Awaited<ReturnType<SecurityService['recordRequest']>> | undefined

    for (let i = 1; i <= SEGMENT_ALERT_THRESHOLD + 1; i += 1) {
      latest = await service.recordRequest({
        ip: '203.0.113.77',
        path: `/anon-${i}.ts`,
        tsMs: 9_000 + i,
      })
    }

    expect(latest).toMatchObject({
      alerts: [{ type: 'segment_scrape', account: undefined, action: 'flag' }],
    })
  })

  it('deduplicates identical alerts for 30 seconds and emits them again after the window', async () => {
    for (let i = 1; i <= SEGMENT_ALERT_THRESHOLD; i += 1) {
      await request(service, { path: `/dup-${i}.ts`, tsMs: 20_000 + i })
    }

    const firstTs = 20_000 + SEGMENT_ALERT_THRESHOLD + 1
    const first = await request(service, { path: '/dup-a.ts', tsMs: firstTs })
    const duplicate = await request(service, { path: '/dup-b.ts', tsMs: firstTs + 1 })
    const afterWindow = await request(service, { path: '/dup-c.ts', tsMs: firstTs + 30_001 })

    expect(first.alerts).toHaveLength(1)
    expect(duplicate.alerts).toHaveLength(0)
    expect(afterWindow.alerts).toHaveLength(1)
  })

  it('does not deduplicate a block escalation after a recent flag', async () => {
    for (let i = 1; i <= SEGMENT_ALERT_THRESHOLD; i += 1) {
      await request(service, { path: `/esc-${i}.ts`, tsMs: 40_000 + i })
    }

    const flag = await request(service, {
      path: `/esc-${SEGMENT_ALERT_THRESHOLD + 1}.ts`,
      tsMs: 40_000 + SEGMENT_ALERT_THRESHOLD + 1,
    })
    let block: Awaited<ReturnType<SecurityService['recordRequest']>> | undefined
    for (let i = SEGMENT_ALERT_THRESHOLD + 2; i <= SEGMENT_BLOCK_THRESHOLD + 1; i += 1) {
      block = await request(service, { path: `/esc-${i}.ts`, tsMs: 40_000 + i })
    }

    expect(flag.alerts).toMatchObject([{ action: 'flag' }])
    expect(block).toMatchObject({
      blocked: true,
      alerts: [{ type: 'segment_scrape', action: 'block' }],
    })
  })

  it('matches proxy CIDRs and exact /32s while ignoring invalid IPs', async () => {
    fsMock.readFile.mockResolvedValueOnce(['10.0.0.0/8', '192.0.2.42/32'].join('\n'))
    await service.onModuleInit()

    await expect(
      request(service, { account: undefined, ip: '10.1.2.3' }),
    ).resolves.toMatchObject({
      alerts: [{ type: 'proxy_ip' }],
    })
    await expect(
      request(service, { account: undefined, ip: '192.0.2.42' }),
    ).resolves.toMatchObject({
      alerts: [{ type: 'proxy_ip' }],
    })
    await expect(
      request(service, { account: undefined, ip: '11.0.0.1' }),
    ).resolves.toMatchObject({
      alerts: [],
    })
    await expect(
      request(service, { account: undefined, ip: '192.0.2.43' }),
    ).resolves.toMatchObject({
      alerts: [],
    })
    await expect(
      request(service, { account: undefined, ip: '999.1.1.1' }),
    ).resolves.toMatchObject({
      alerts: [],
    })
    await expect(
      request(service, { account: undefined, ip: '1.2.3' }),
    ).resolves.toMatchObject({
      alerts: [],
    })
    await expect(
      request(service, { account: undefined, ip: 'abc' }),
    ).resolves.toMatchObject({
      alerts: [],
    })
    await expect(
      request(service, { account: undefined, ip: '::ffff:10.0.0.1' }),
    ).resolves.toMatchObject({
      alerts: [{ type: 'proxy_ip' }],
    })
  })

  it('supports a /0 proxy CIDR and normalizes loopback IPv6 shorthand', async () => {
    fsMock.readFile.mockResolvedValueOnce('0.0.0.0/0')
    await service.onModuleInit()

    await expect(
      request(service, { account: undefined, ip: '203.0.113.55' }),
    ).resolves.toMatchObject({
      alerts: [{ type: 'proxy_ip' }],
    })
    await expect(
      request(service, { account: undefined, ip: '::1' }),
    ).resolves.toMatchObject({
      alerts: [{ type: 'proxy_ip' }],
    })
  })
})
