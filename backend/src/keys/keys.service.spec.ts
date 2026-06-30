import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { appendFile, mkdir, readFile } from 'fs/promises'
import type { JwtUser } from '../common/request-context'
import type { Content, ContentsService } from '../contents/contents.service'
import { KeysService } from './keys.service'

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

// Mock du contrat multi-tenant consomme par KeysService : seules find() et
// isAllowed() sont utilisees ici.
type ContentsMock = {
  find: jest.MockedFunction<ContentsService['find']>
  isAllowed: jest.MockedFunction<ContentsService['isAllowed']>
}

// Utilisateurs de test. companyId = tenant ; le superadmin n'a pas de tenant.
const alice: JwtUser = { sub: 1, username: 'alice', role: 'user', companyId: 'demo' }
const mallory: JwtUser = { sub: 9, username: 'mallory', role: 'user', companyId: 'demo' }
const eve: JwtUser = { sub: 5, username: 'eve', role: 'user', companyId: 'acme' }
const root: JwtUser = { sub: 1, username: 'root', role: 'superadmin', companyId: null }
const context = { ip: '203.0.113.10' }

function content(overrides: Partial<Content> = {}): Content {
  return {
    id: 'poc',
    title: 'POC Parc des Princes',
    companyId: 'demo',
    allowedUsernames: ['alice'],
    revoked: false,
    ...overrides,
  }
}

function lastAuditRecord() {
  const line = String(fsMock.appendFile.mock.calls.at(-1)?.[1] ?? '')
  return JSON.parse(line.trim())
}

describe('KeysService', () => {
  let service: KeysService
  let contents: ContentsMock

  beforeEach(() => {
    contents = {
      find: jest.fn(),
      isAllowed: jest.fn(),
    }
    service = new KeysService(contents as unknown as ContentsService)
    fsMock.appendFile.mockResolvedValue(undefined)
    fsMock.mkdir.mockResolvedValue(undefined)
    fsMock.readFile.mockReset()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // Traversee de chemin : l'identifiant est valide AVANT toute interaction. On
  // verifie que ContentsService n'est meme pas interroge (sinon la validation a
  // ete contournee) et qu'aucune cle n'est lue.
  it.each(['../../etc/passwd', '..\\..', 'poc/../poc', 'Poc', '.poc', 'a'.repeat(65)])(
    'rejects invalid content id %s before touching ContentsService or the disk',
    async (contentId) => {
      await expect(service.getKey(contentId, alice, context)).rejects.toBeInstanceOf(
        NotFoundException,
      )

      expect(contents.find).not.toHaveBeenCalled()
      expect(fsMock.readFile).not.toHaveBeenCalled()
      expect(lastAuditRecord()).toMatchObject({
        result: 'denied',
        reason: 'invalid_content_id',
      })
    },
  )

  it('returns 404 (not 403) for an unknown content id', async () => {
    contents.find.mockReturnValue(undefined)

    await expect(service.getKey('ghost', alice, context)).rejects.toBeInstanceOf(
      NotFoundException,
    )

    expect(contents.isAllowed).not.toHaveBeenCalled()
    expect(fsMock.readFile).not.toHaveBeenCalled()
    expect(lastAuditRecord()).toMatchObject({
      result: 'denied',
      reason: 'content_not_found',
    })
  })

  // Isolation entreprise : un contenu d'un AUTRE tenant doit renvoyer 404
  // (NotFound), jamais 403 — sinon on revele son existence. Le controle d'acces
  // fin (isAllowed) ne doit meme pas etre consulte, ni le disque touche.
  it('hides cross-tenant content behind a 404 without checking the ACL or the disk', async () => {
    contents.find.mockReturnValue(content({ companyId: 'demo' }))

    await expect(service.getKey('poc', eve, context)).rejects.toBeInstanceOf(
      NotFoundException,
    )

    expect(contents.isAllowed).not.toHaveBeenCalled()
    expect(fsMock.readFile).not.toHaveBeenCalled()
    expect(lastAuditRecord()).toMatchObject({
      result: 'denied',
      reason: 'cross_tenant',
    })
  })

  // Le superadmin franchit la barriere de tenant : contenu d'un autre tenant,
  // mais acces accorde si isAllowed le confirme.
  it('lets a superadmin bypass the tenant boundary', async () => {
    const key = Buffer.from('superadmin-key')
    contents.find.mockReturnValue(content({ companyId: 'demo' }))
    contents.isAllowed.mockReturnValue(true)
    fsMock.readFile.mockResolvedValueOnce(key)

    await expect(service.getKey('poc', root, context)).resolves.toBe(key)

    expect(lastAuditRecord()).toMatchObject({
      result: 'granted',
      reason: 'content_acl_granted',
    })
  })

  // Revocation : prioritaire sur le controle d'acces fin (403 key_revoked, pas
  // un content_acl_denied) et avant toute lecture de cle.
  it('refuses a revoked key with 403 before consulting the ACL or the disk', async () => {
    contents.find.mockReturnValue(content({ revoked: true }))

    await expect(service.getKey('poc', alice, context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )

    expect(contents.isAllowed).not.toHaveBeenCalled()
    expect(fsMock.readFile).not.toHaveBeenCalled()
    expect(lastAuditRecord()).toMatchObject({
      result: 'denied',
      reason: 'key_revoked',
    })
  })

  it('denies a same-tenant user not on the ACL before reading the key', async () => {
    contents.find.mockReturnValue(content())
    contents.isAllowed.mockReturnValue(false)

    await expect(service.getKey('poc', mallory, context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )

    expect(fsMock.readFile).not.toHaveBeenCalled()
    expect(lastAuditRecord()).toMatchObject({
      result: 'denied',
      reason: 'content_acl_denied',
    })
  })

  it('maps a missing key file to 404 without leaking a filesystem error', async () => {
    contents.find.mockReturnValue(content())
    contents.isAllowed.mockReturnValue(true)
    fsMock.readFile.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'ENOENT' }),
    )

    await expect(service.getKey('poc', alice, context)).rejects.toBeInstanceOf(
      NotFoundException,
    )

    expect(fsMock.readFile).toHaveBeenCalledTimes(1)
    expect(lastAuditRecord()).toMatchObject({
      result: 'denied',
      reason: 'key_not_found',
    })
  })

  it('returns the key buffer and logs a granted audit line for an authorized user', async () => {
    const key = Buffer.from('0123456789abcdef')
    contents.find.mockReturnValue(content())
    contents.isAllowed.mockReturnValue(true)
    fsMock.readFile.mockResolvedValueOnce(key)

    await expect(service.getKey('poc', alice, context)).resolves.toBe(key)

    expect(lastAuditRecord()).toMatchObject({
      user: 'alice',
      sub: 1,
      contentId: 'poc',
      ip: context.ip,
      result: 'granted',
      reason: 'content_acl_granted',
    })
  })
})
