import { describe, expect, it, vi, beforeEach } from 'vitest'

// On isole la couche API : authFetch est moqué, on vérifie les requêtes émises
// (méthode, chemin, corps) et le mapping des erreurs vers des messages clairs.
vi.mock('./auth', () => ({ authFetch: vi.fn() }))

import { authFetch } from './auth'
import {
  listCompanies,
  createCompany,
  inviteAdmin,
  deleteCompany,
  createUser,
  setUserRole,
  deleteUser,
  grantAccess,
  revokeAccess,
  revokeKey,
} from './admin'

// Fabrique une réponse type fetch. `text()` sert au chemin succès, `json()` au
// chemin erreur (lecture du message serveur).
function makeRes({ ok = true, status = 200, body = null }) {
  const str = body == null ? '' : JSON.stringify(body)
  return {
    ok,
    status,
    text: async () => str,
    json: async () => body ?? {},
  }
}

beforeEach(() => {
  authFetch.mockReset()
})

describe('admin API - construction des requetes', () => {
  it('listCompanies fait un GET sur /admin/companies et parse le JSON', async () => {
    authFetch.mockResolvedValue(makeRes({ body: [{ id: 'demo', name: 'Demo Corp' }] }))
    const out = await listCompanies()
    expect(authFetch).toHaveBeenCalledWith('/admin/companies', undefined)
    expect(out).toEqual([{ id: 'demo', name: 'Demo Corp' }])
  })

  it('createCompany poste le nom en JSON', async () => {
    authFetch.mockResolvedValue(makeRes({ status: 201, body: { id: 'x', name: 'Acme' } }))
    await createCompany('Acme')
    const [path, options] = authFetch.mock.calls[0]
    expect(path).toBe('/admin/companies')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ name: 'Acme' })
  })

  it('inviteAdmin encode le companyId dans le chemin', async () => {
    authFetch.mockResolvedValue(makeRes({ body: { invitation: {} } }))
    await inviteAdmin('a b/c', 'rep@acme.com')
    const [path] = authFetch.mock.calls[0]
    expect(path).toBe('/admin/companies/a%20b%2Fc/invite-admin')
  })

  it('createUser transmet companyId quand fourni (superadmin)', async () => {
    authFetch.mockResolvedValue(makeRes({ status: 201, body: {} }))
    await createUser({ username: 'dave', password: 'secret12', companyId: 'demo' })
    const [, options] = authFetch.mock.calls[0]
    expect(JSON.parse(options.body)).toEqual({
      username: 'dave',
      password: 'secret12',
      companyId: 'demo',
    })
  })

  it('grantAccess poste le username sur la bonne route', async () => {
    authFetch.mockResolvedValue(makeRes({ body: {} }))
    await grantAccess('poc', 'dave')
    const [path, options] = authFetch.mock.calls[0]
    expect(path).toBe('/admin/contents/poc/access')
    expect(JSON.parse(options.body)).toEqual({ username: 'dave' })
  })

  it('revokeAccess utilise DELETE avec chemin encodé', async () => {
    authFetch.mockResolvedValue(makeRes({ body: {} }))
    await revokeAccess('poc', 'dave doe')
    const [path, options] = authFetch.mock.calls[0]
    expect(path).toBe('/admin/contents/poc/access/dave%20doe')
    expect(options.method).toBe('DELETE')
  })

  it('revokeKey fait un POST sur /revoke', async () => {
    authFetch.mockResolvedValue(makeRes({ body: { revoked: true } }))
    await revokeKey('poc')
    const [path, options] = authFetch.mock.calls[0]
    expect(path).toBe('/admin/contents/poc/revoke')
    expect(options.method).toBe('POST')
  })

  it('deleteCompany fait un DELETE sur /admin/companies/:id', async () => {
    authFetch.mockResolvedValue(makeRes({ body: { deleted: {} } }))
    await deleteCompany('9442f570')
    const [path, options] = authFetch.mock.calls[0]
    expect(path).toBe('/admin/companies/9442f570')
    expect(options.method).toBe('DELETE')
  })

  it('setUserRole fait un PATCH avec le rôle en JSON', async () => {
    authFetch.mockResolvedValue(makeRes({ body: { role: 'admin' } }))
    await setUserRole('dave', 'admin')
    const [path, options] = authFetch.mock.calls[0]
    expect(path).toBe('/admin/users/dave/role')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ role: 'admin' })
  })

  it('deleteUser fait un DELETE avec identifiant encodé', async () => {
    authFetch.mockResolvedValue(makeRes({ body: { deleted: 'a@b.com' } }))
    await deleteUser('a@b.com')
    const [path, options] = authFetch.mock.calls[0]
    expect(path).toBe('/admin/users/a%40b.com')
    expect(options.method).toBe('DELETE')
  })
})

describe('admin API - mapping des erreurs', () => {
  it('409 remonte le message serveur', async () => {
    authFetch.mockResolvedValue(
      makeRes({ ok: false, status: 409, body: { message: 'Utilisateur déjà existant' } }),
    )
    await expect(createUser({ username: 'a', password: 'b' })).rejects.toThrow(
      'Utilisateur déjà existant',
    )
  })

  it('403 sans message donne un libellé par défaut', async () => {
    authFetch.mockResolvedValue(makeRes({ ok: false, status: 403, body: {} }))
    await expect(listCompanies()).rejects.toThrow('Accès refusé (droits insuffisants).')
  })

  it('400 avec message tableau est joint', async () => {
    authFetch.mockResolvedValue(
      makeRes({
        ok: false,
        status: 400,
        body: { message: ['name requis', 'trop court'] },
      }),
    )
    await expect(createCompany('')).rejects.toThrow('name requis, trop court')
  })

  it('401 renvoie un message de session expirée', async () => {
    authFetch.mockResolvedValue(makeRes({ ok: false, status: 401, body: {} }))
    await expect(listCompanies()).rejects.toThrow('Session expirée. Reconnectez-vous.')
  })
})
