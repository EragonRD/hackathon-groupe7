import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./auth', () => ({ authFetch: vi.fn() }))

import { authFetch } from './auth'
import { listMyContents } from './contents'

function makeRes({ ok = true, status = 200, body = null }) {
  const str = body == null ? '' : JSON.stringify(body)
  return { ok, status, text: async () => str, json: async () => body ?? {} }
}

beforeEach(() => {
  authFetch.mockReset()
})

describe('listMyContents', () => {
  it('fait un GET sur /contents et parse le tableau', async () => {
    const list = [{ id: 'poc', title: 'POC', revoked: false, playable: true }]
    authFetch.mockResolvedValue(makeRes({ body: list }))
    const out = await listMyContents()
    expect(authFetch).toHaveBeenCalledWith('/contents')
    expect(out).toEqual(list)
  })

  it('renvoie [] sur corps vide', async () => {
    authFetch.mockResolvedValue(makeRes({ body: null }))
    expect(await listMyContents()).toEqual([])
  })

  it('lève un message de session expirée sur 401', async () => {
    authFetch.mockResolvedValue(makeRes({ ok: false, status: 401 }))
    await expect(listMyContents()).rejects.toThrow('Session expirée. Reconnectez-vous.')
  })

  it('lève un message générique sur erreur serveur', async () => {
    authFetch.mockResolvedValue(makeRes({ ok: false, status: 500 }))
    await expect(listMyContents()).rejects.toThrow('Impossible de charger vos contenus.')
  })
})
