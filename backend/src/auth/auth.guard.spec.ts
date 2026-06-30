import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AuthGuard } from './auth.guard'

const JWT_SECRET = 'test-secret-with-enough-length'

function httpContext(req: {
  headers: Record<string, string | undefined>
  user?: unknown
}) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext
}

describe('AuthGuard', () => {
  let jwt: JwtService
  let guard: AuthGuard

  beforeEach(() => {
    jwt = new JwtService({
      secret: JWT_SECRET,
      signOptions: { algorithm: 'HS256', expiresIn: '15m' },
    })
    guard = new AuthGuard(jwt)
  })

  it('rejects a missing authorization header', async () => {
    await expect(guard.canActivate(httpContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('rejects an authorization header without the Bearer prefix', async () => {
    await expect(
      guard.canActivate(httpContext({ headers: { authorization: 'Basic abc' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('attaches the decoded identity for a valid token', async () => {
    const req = { headers: { authorization: '' }, user: undefined }
    const token = await jwt.signAsync({ sub: 1, username: 'alice', role: 'admin' })
    req.headers.authorization = `Bearer ${token}`

    await expect(guard.canActivate(httpContext(req))).resolves.toBe(true)
    expect(req.user).toMatchObject({ sub: 1, username: 'alice', role: 'admin' })
  })

  it('rejects an expired token', async () => {
    const token = await jwt.signAsync(
      { sub: 1, username: 'alice', role: 'admin' },
      { expiresIn: '-1s' },
    )

    await expect(
      guard.canActivate(httpContext({ headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects tokens signed with a different key', async () => {
    const forged = await new JwtService({
      secret: 'different-secret-with-enough-length',
      signOptions: { algorithm: 'HS256', expiresIn: '15m' },
    }).signAsync({ sub: 1, username: 'alice', role: 'admin' })

    await expect(
      guard.canActivate(httpContext({ headers: { authorization: `Bearer ${forged}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  // Anti-confusion d'algorithme : un token HS384 signé avec LE BON secret serait
  // accepte par la liste d'algos HMAC par defaut de jsonwebtoken. Le guard epingle
  // `algorithms: ['HS256']`, il doit donc le refuser. Si l'on retire l'epinglage,
  // ce test rougit (alors que le test "different key" passerait toujours).
  it('rejects a token signed with a non-HS256 algorithm even with the right secret', async () => {
    const token = await new JwtService({ secret: JWT_SECRET }).signAsync(
      { sub: 1, username: 'alice', role: 'admin' },
      { algorithm: 'HS384' },
    )

    await expect(
      guard.canActivate(httpContext({ headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
