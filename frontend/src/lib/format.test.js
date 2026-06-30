import { describe, expect, it } from 'vitest'
import { colorForUser, formatTime, initials, shortId } from './format'

const USER_COLORS = [
  '#4d9bff',
  '#2ec27e',
  '#f5a623',
  '#ff5b7f',
  '#b07bff',
  '#29c5e6',
  '#ff8a3d',
  '#5be0b0',
]

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [65, '1:05'],
    [3600, '1:00:00'],
    [3661, '1:01:01'],
    [-5, '0:00'],
    [Number.NaN, '0:00'],
    [undefined, '0:00'],
    [42.7, '0:42'],
  ])('formats %s seconds as %s', (input, expected) => {
    expect(formatTime(input)).toBe(expected)
  })
})

describe('colorForUser', () => {
  it('returns a deterministic palette color for the same user key', () => {
    const first = colorForUser('alice')
    const second = colorForUser('alice')

    expect(second).toBe(first)
    expect(USER_COLORS).toContain(first)
  })

  it.each([null, undefined, '', 'bob'])(
    'never crashes and stays in the palette for %s',
    (key) => {
      expect(USER_COLORS).toContain(colorForUser(key))
    },
  )
})

describe('initials', () => {
  it.each([
    ['alice', 'AL'],
    ['Jean Dupont', 'JD'],
    ['a', 'A'],
    [null, '?'],
    ['  ', ''],
    ['', ''],
  ])('builds at most two initials from %s', (name, expected) => {
    expect(initials(name)).toBe(expected)
    expect(initials(name).length).toBeLessThanOrEqual(2)
  })
})

describe('shortId', () => {
  it('returns eight-character ids and consecutive calls differ', () => {
    const first = shortId()
    const second = shortId()

    expect(first).toHaveLength(8)
    expect(second).toHaveLength(8)
    expect(second).not.toBe(first)
  })
})
