import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    emit: vi.fn(),
    on: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

class FakeBroadcastChannel {
  static channels = new Map()

  constructor(name) {
    this.name = name
    this.onmessage = null
    const peers = FakeBroadcastChannel.channels.get(name) ?? new Set()
    peers.add(this)
    FakeBroadcastChannel.channels.set(name, peers)
  }

  postMessage(data) {
    for (const peer of FakeBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer !== this && peer.onmessage) {
        peer.onmessage({ data })
      }
    }
  }

  close() {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this)
    this.onmessage = null
  }
}

describe('createTransport', () => {
  let originalBroadcastChannel

  beforeEach(() => {
    vi.resetModules()
    FakeBroadcastChannel.channels.clear()
    originalBroadcastChannel = globalThis.BroadcastChannel
    globalThis.BroadcastChannel = FakeBroadcastChannel
  })

  afterEach(() => {
    globalThis.BroadcastChannel = originalBroadcastChannel
    vi.clearAllMocks()
  })

  it('selects the BroadcastChannel adapter when requested', async () => {
    const { createTransport } = await import('./collab')
    const transport = createTransport('s1', { mode: 'broadcast' })

    expect(transport.mode).toBe('broadcast')
    expect(typeof transport.post).toBe('function')
    expect(typeof transport.subscribe).toBe('function')
    expect(typeof transport.close).toBe('function')

    transport.close()
  })

  it('selects the socket adapter without requiring a live connection', async () => {
    const { createTransport } = await import('./collab')
    const transport = createTransport('s1', { mode: 'socket', url: 'http://test.local' })

    expect(transport.mode).toBe('socket')
    expect(() => transport.post({ type: 'ping' })).not.toThrow()
    expect(() => transport.subscribe(() => {})).not.toThrow()
    expect(() => transport.close()).not.toThrow()
  })

  it('falls back to an inert transport when BroadcastChannel is unavailable', async () => {
    globalThis.BroadcastChannel = undefined
    const { createTransport } = await import('./collab')
    const transport = createTransport('s1', { mode: 'broadcast' })

    expect(transport.mode).toBe('none')
    expect(() => transport.post({ type: 'ping' })).not.toThrow()
    expect(() => transport.subscribe(() => {})).not.toThrow()
    expect(() => transport.close()).not.toThrow()
  })

  it('relays BroadcastChannel messages to peers in the same session without echoing the sender', async () => {
    const { createTransport } = await import('./collab')
    const a = createTransport('s1', { mode: 'broadcast' })
    const b = createTransport('s1', { mode: 'broadcast' })
    const c = createTransport('s2', { mode: 'broadcast' })
    const receivedByA = []
    const receivedByB = []
    const receivedByC = []

    a.subscribe((msg) => receivedByA.push(msg))
    const unsubscribeB = b.subscribe((msg) => receivedByB.push(msg))
    c.subscribe((msg) => receivedByC.push(msg))

    a.post({ type: 'note:add', payload: { id: 'n1' } })

    expect(receivedByA).toEqual([])
    expect(receivedByB).toEqual([{ type: 'note:add', payload: { id: 'n1' } }])
    expect(receivedByC).toEqual([])

    unsubscribeB()
    a.post({ type: 'note:add', payload: { id: 'n2' } })

    expect(receivedByB).toEqual([{ type: 'note:add', payload: { id: 'n1' } }])

    a.close()
    b.close()
    c.close()
  })
})
