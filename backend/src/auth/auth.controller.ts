import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { AuthGuard } from './auth.guard'
import { extractClientIp } from '../common/request-context'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // POST /auth/login  { username, password }  ->  { accessToken, user }
  // Rate-limit strict par IP (10/min) : ralentit fortement le credential stuffing,
  // en complément du verrouillage de compte côté AuthService.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Req() req: Request, @Body() body: { username?: string; password?: string }) {
    if (!body?.username || !body?.password) {
      throw new UnauthorizedException('username et password requis')
    }
    return this.auth.login(body.username, body.password, extractClientIp(req))
  }

  // POST /auth/refresh  { refreshToken }  ->  nouvel access token (+ rotation refresh)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() body: { refreshToken?: string }) {
    if (!body?.refreshToken) throw new UnauthorizedException('refreshToken requis')
    return this.auth.refresh(body.refreshToken)
  }

  // POST /auth/logout  { refreshToken }  -> révoque le refresh token (vrai logout)
  @Post('logout')
  @HttpCode(204)
  logout(@Body() body: { refreshToken?: string }): void {
    if (body?.refreshToken) this.auth.logout(body.refreshToken)
  }

  // GET /auth/me  (route protégée d'exemple) -> l'utilisateur courant.
  // Montre comment lire l'identité une fois le token vérifié par le guard.
  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return (req as Request & { user?: unknown }).user
  }

  // POST /auth/change-password  { currentPassword, newPassword }
  // Première connexion d'un admin invité : il pose son vrai mot de passe.
  // Renvoie un NOUVEAU token (sans le flag mustChangePassword).
  @UseGuards(AuthGuard)
  @Post('change-password')
  changePassword(
    @Req() req: Request,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    const user = (req as Request & { user?: { username: string } }).user
    if (!body?.currentPassword || !body?.newPassword) {
      throw new UnauthorizedException('currentPassword et newPassword requis')
    }
    return this.auth.changePassword(
      user!.username,
      body.currentPassword,
      body.newPassword,
    )
  }
}
