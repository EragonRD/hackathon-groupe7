import { appendFile, mkdir, readFile } from 'fs/promises'
import { SecurityService } from './security.service'

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

  it('escalates segment scraping from no alert to flag to block at exact thresholds', async () => {
    for (let i = 1; i <= 8; i += 1) {
      const result = await request(service, { path: `/seg-${i}.ts`, tsMs: 2_000 + i })
      expect(result.alerts).toHaveLength(0)
      expect(result.blocked).toBe(false)
    }

    const flag = await request(service, { path: '/seg-9.ts', tsMs: 2_009 })
    expect(flag).toMatchObject({
      blocked: false,
      alerts: [{ type: 'segment_scrape', action: 'flag' }],
    })

    for (let i = 10; i <= 20; i += 1) {
      await request(service, { path: `/seg-${i}.ts`, tsMs: 2_000 + i })
    }

    const block = await request(service, { path: '/seg-21.ts', tsMs: 2_021 })
    expect(block).toMatchObject({
      blocked: true,
      alerts: [{ type: 'segment_scrape', action: 'block' }],
    })
  })

  // Discrimine reellement l'exclusion : 8 vraies requetes .ts (= seuil, aucune alerte)
  // PLUS un .tsx et un .ts au milieu du chemin. Le bon regex compte 8 -> aucune alerte.
  // Un regex trop large (ex. /\.ts/) compterait 10 et declencherait une alerte.
  // On agrege les alertes de TOUTES les requetes : sinon le dedup masquerait une
  // alerte tiree a l'avant-derniere requete (la derniere reviendrait vide).
  it('does not count .tsx or path-embedded .ts as segments', async () => {
    const paths = [
      '/seg1.ts',
      '/seg2.ts',
      '/seg3.ts',
      '/seg4.ts',
      '/report.tsx',
      '/a.ts/b',
      '/seg5.ts',
      '/seg6.ts',
      '/seg7.ts',
      '/seg8.ts',
    ]
    const allAlerts = []

    for (const [index, path] of paths.entries()) {
      const result = await request(service, { path, tsMs: 5_000 + index })
      allAlerts.push(...result.alerts)
    }

    expect(allAlerts).toEqual([])
  })

  // Discrimine l'inverse : ?query et #fragment apres .ts comptent bien. 7 .ts simples
  // + 1 ".ts?token" + 1 ".ts#frag" = 9 -> flag. Un regex en /\.ts$/ raterait les deux
  // suffixes -> 7 -> aucune alerte, donc ce test rougirait.
  it('counts .ts URLs with a query or fragment suffix', async () => {
    const paths = [
      '/seg1.ts',
      '/seg2.ts',
      '/seg3.ts',
      '/seg4.ts',
      '/seg5.ts',
      '/seg6.ts',
      '/seg7.ts',
      '/seg8.ts?token=x',
      '/seg9.ts#frag',
    ]
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

    for (let i = 1; i <= 9; i += 1) {
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
    for (let i = 1; i <= 8; i += 1) {
      await request(service, { path: `/dup-${i}.ts`, tsMs: 20_000 + i })
    }

    const first = await request(service, { path: '/dup-9.ts', tsMs: 20_009 })
    const duplicate = await request(service, { path: '/dup-10.ts', tsMs: 20_010 })
    const afterWindow = await request(service, {
      path: '/dup-11.ts',
      tsMs: 20_009 + 30_001,
    })

    expect(first.alerts).toHaveLength(1)
    expect(duplicate.alerts).toHaveLength(0)
    expect(afterWindow.alerts).toHaveLength(1)
  })

  it('does not deduplicate a block escalation after a recent flag', async () => {
    for (let i = 1; i <= 8; i += 1) {
      await request(service, { path: `/esc-${i}.ts`, tsMs: 40_000 + i })
    }

    const flag = await request(service, { path: '/esc-9.ts', tsMs: 40_009 })
    let block: Awaited<ReturnType<SecurityService['recordRequest']>> | undefined
    for (let i = 10; i <= 21; i += 1) {
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
