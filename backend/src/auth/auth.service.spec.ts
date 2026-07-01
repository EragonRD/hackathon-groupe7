import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { AuthService } from './auth.service'
import { UsersService } from './users.service'
import { SessionService } from './session.service'

jest.mock('argon2', () => {
  const actual = jest.requireActual<typeof import('argon2')>('argon2')
  return {
    ...actual,
    verify: jest.fn(actual.verify),
  }
})

const JWT_SECRET = 'test-secret-with-enough-length'
const LOCK_MS = 5 * 60 * 1000
const BASE_TIME = new Date('2026-06-30T10:00:00.000Z').getTime()

describe('AuthService', () => {
  let service: AuthService
  let jwt: JwtService
  let users: jest.Mocked<Pick<UsersService, 'findByUsername'>>
  let passwordHash: string
  let now: number

  beforeAll(async () => {
    passwordHash = await argon2.hash('correct-password')
  })

  beforeEach(() => {
    now = BASE_TIME
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    jest.mocked(argon2.verify).mockClear()
    jwt = new JwtService({
      secret: JWT_SECRET,
      signOptions: { algorithm: 'HS256', expiresIn: '15m' },
    })
    users = {
      findByUsername: jest.fn((username: string) =>
        Promise.resolve(
          username === 'alice'
            ? {
                id: 1,
                username: 'alice',
                role: 'admin',
                passwordHash,
              }
            : undefined,
        ),
      ),
    }
    service = new AuthService(users as UsersService, jwt, new SessionService(false))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns a JWT whose payload identifies the authenticated user', async () => {
    const result = await service.login('alice', 'correct-password')

    const payload = await jwt.verifyAsync(result.accessToken, {
      secret: JWT_SECRET,
      algorithms: ['HS256'],
    })
    expect(result.user).toEqual({ id: 1, username: 'alice', role: 'admin' })
    expect(payload).toMatchObject({ sub: 1, username: 'alice', role: 'admin' })
  })

  it('rejects a wrong password', async () => {
    await expect(service.login('alice', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('rejects an unknown user with the same exception type as a wrong password', async () => {
    await expect(service.login('mallory', 'anything')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('verifies the dummy hash for an unknown user to avoid account enumeration', async () => {
    const verifySpy = jest.mocked(argon2.verify)

    await expect(service.login('mallory', 'anything')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )

    expect(verifySpy).toHaveBeenCalledTimes(1)
    expect(verifySpy.mock.calls[0][0]).toMatch(/^\$argon2id\$/)
  })

  it('locks the account on the fifth failure and short-circuits password verification while locked', async () => {
    const verifySpy = jest.mocked(argon2.verify)

    for (let i = 0; i < 4; i += 1) {
      await expect(service.login('alice', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    }
    expect(verifySpy).toHaveBeenCalledTimes(4)

    await expect(service.login('alice', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
    expect(verifySpy).toHaveBeenCalledTimes(5)

    await expect(service.login('alice', 'correct-password')).rejects.toThrow(
      HttpException,
    )
    await service.login('alice', 'correct-password').catch((error: HttpException) => {
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
    })
    expect(verifySpy).toHaveBeenCalledTimes(5)
  })

  it('evaluates the password again after the lock window expires', async () => {
    const verifySpy = jest.mocked(argon2.verify)

    for (let i = 0; i < 5; i += 1) {
      await expect(service.login('alice', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    }

    now += LOCK_MS + 1

    await expect(service.login('alice', 'correct-password')).resolves.toMatchObject({
      user: { username: 'alice' },
    })
    expect(verifySpy).toHaveBeenCalledTimes(6)
  })

  it('resets failed attempts after a successful login', async () => {
    for (let i = 0; i < 4; i += 1) {
      await expect(service.login('alice', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    }

    await expect(service.login('alice', 'correct-password')).resolves.toMatchObject({
      user: { username: 'alice' },
    })

    for (let i = 0; i < 4; i += 1) {
      await expect(service.login('alice', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    }

    await expect(service.login('alice', 'correct-password')).resolves.toMatchObject({
      user: { username: 'alice' },
    })

    for (let i = 0; i < 5; i += 1) {
      await expect(service.login('alice', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    }
    await expect(service.login('alice', 'correct-password')).rejects.toThrow(
      HttpException,
    )
  })
})
