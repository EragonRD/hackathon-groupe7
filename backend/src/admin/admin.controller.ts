import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { AuthGuard } from '../auth/auth.guard'
import { AdminGuard } from '../auth/admin.guard'
import { SuperAdminGuard } from '../auth/superadmin.guard'
import { PasswordChangedGuard } from '../auth/password-changed.guard'
import { UsersService } from '../auth/users.service'
import { CompaniesService } from '../companies/companies.service'
import { ContentsService } from '../contents/contents.service'
import type { Content } from '../contents/contents.service'
import { EmailService } from '../email/email.service'
import type { JwtUser, RequestWithUser } from '../common/request-context'

const INVITE_TTL_MS = 24 * 60 * 60 * 1000 // 24 h
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

// 🛡️ Back-office multi-tenant. Toutes les routes exigent un JWT (AuthGuard) ET
//    que l'utilisateur ait changé son mot de passe temporaire (PasswordChangedGuard).
//    • /admin/companies*  → SUPER-ADMIN (gestion des entreprises + de leurs admins)
//    • le reste           → ADMIN de l'entreprise (ou superadmin), strictement scoppé
@UseGuards(AuthGuard, PasswordChangedGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly companies: CompaniesService,
    private readonly contents: ContentsService,
    private readonly email: EmailService,
  ) {}

  // ───────────────────────── SUPER-ADMIN ─────────────────────────

  @UseGuards(SuperAdminGuard)
  @Get('companies')
  listCompanies() {
    return this.companies.list()
  }

  @UseGuards(SuperAdminGuard)
  @Post('companies')
  createCompany(@Body() body: { name?: string }) {
    if (!body?.name) throw new BadRequestException('name requis')
    return this.companies.create(body.name)
  }

  // Inviter l'ADMIN d'une entreprise : crée le compte avec un mot de passe
  // TEMPORAIRE (24 h), changement forcé, et "envoie" le lien d'invitation au mail
  // du représentant. Renvoie aussi l'invitation (lien + mot de passe temporaire).
  @UseGuards(SuperAdminGuard)
  @Post('companies/:id/invite-admin')
  async inviteCompanyAdmin(
    @Param('id') companyId: string,
    @Body() body: { email?: string },
  ) {
    const company = this.companies.find(companyId)
    if (!company) throw new NotFoundException('Entreprise inconnue')
    const email = body?.email?.trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException('Email valide requis')
    }
    if (this.users.exists(email))
      throw new ConflictException('Un compte avec cet email existe déjà')

    const tempPassword = randomBytes(9).toString('base64url') // ~12 caractères
    const expiresAt = Date.now() + INVITE_TTL_MS
    const admin = await this.users.createInvitedAdmin({
      email,
      companyId,
      tempPassword,
      expiresAt,
    })

    const link = `${APP_URL}/login?email=${encodeURIComponent(email)}`
    const delivery = await this.email.sendAdminInvite({
      to: email,
      companyName: company.name,
      link,
      tempPassword,
      expiresAt,
    })

    return {
      invited: admin,
      invitation: { email, companyId, link, tempPassword, expiresAt },
      delivery,
      message: delivery.delivered
        ? 'Invitation envoyée par email (mot de passe temporaire valable 24 h)'
        : 'Invitation créée — email non configuré ou échec, partagez le lien manuellement',
    }
  }

  // ───────────────────────── ADMIN D'ENTREPRISE ─────────────────────────

  // Utilisateurs : superadmin = tous ; admin = ceux de SON entreprise.
  @UseGuards(AdminGuard)
  @Get('users')
  listUsers(@Req() req: RequestWithUser) {
    const me = req.user!
    return me.role === 'superadmin'
      ? this.users.listAll()
      : this.users.listByCompany(me.companyId ?? null)
  }

  // Créer un utilisateur (role `user`) dans SON entreprise.
  @UseGuards(AdminGuard)
  @Post('users')
  async createUser(
    @Req() req: RequestWithUser,
    @Body() body: { username?: string; password?: string; companyId?: string },
  ) {
    this.assertCredentials(body)
    const companyId = this.resolveCompanyId(req.user!, body.companyId)
    if (this.users.exists(body.username!))
      throw new ConflictException('Utilisateur déjà existant')
    return this.users.createUser({
      username: body.username!,
      password: body.password!,
      role: 'user',
      companyId,
    })
  }

  // Contenus : superadmin = tous ; admin = ceux de SON entreprise.
  @UseGuards(AdminGuard)
  @Get('contents')
  listContents(@Req() req: RequestWithUser) {
    const me = req.user!
    return me.role === 'superadmin'
      ? this.contents.list()
      : this.contents.listByCompany(me.companyId ?? null)
  }

  @UseGuards(AdminGuard)
  @Post('contents')
  createContent(
    @Req() req: RequestWithUser,
    @Body() body: { title?: string; companyId?: string },
  ) {
    if (!body?.title) throw new BadRequestException('title requis')
    const companyId = this.resolveCompanyId(req.user!, body.companyId)
    return this.contents.create({ title: body.title, companyId })
  }

  @UseGuards(AdminGuard)
  @Post('contents/:id/access')
  async grantAccess(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { username?: string },
  ) {
    const content = this.scopedContent(id, req.user!)
    if (!body?.username) throw new BadRequestException('username requis')
    const target = await this.users.findByUsername(body.username)
    if (!target) throw new NotFoundException('Utilisateur inconnu')
    // On ne donne accès qu'à un utilisateur de la MÊME entreprise que le contenu.
    if (target.companyId !== content.companyId) {
      throw new ForbiddenException("L'utilisateur n'appartient pas à cette entreprise")
    }
    return this.contents.grantAccess(id, body.username)
  }

  @UseGuards(AdminGuard)
  @Delete('contents/:id/access/:username')
  revokeAccess(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('username') username: string,
  ) {
    this.scopedContent(id, req.user!)
    return this.contents.revokeAccess(id, username)
  }

  @UseGuards(AdminGuard)
  @Post('contents/:id/revoke')
  revokeKey(@Req() req: RequestWithUser, @Param('id') id: string) {
    this.scopedContent(id, req.user!)
    const content = this.contents.setRevoked(id, true)
    return { ...content, message: 'Cle revoquee : delivrance bloquee' }
  }

  @UseGuards(AdminGuard)
  @Post('contents/:id/restore')
  restoreKey(@Req() req: RequestWithUser, @Param('id') id: string) {
    this.scopedContent(id, req.user!)
    const content = this.contents.setRevoked(id, false)
    return { ...content, message: 'Delivrance retablie' }
  }

  // ───────────────────────── helpers ─────────────────────────

  private assertCredentials(body: { username?: string; password?: string }): void {
    if (!body?.username || !body?.password) {
      throw new BadRequestException('username et password requis')
    }
  }

  // Détermine l'entreprise cible : un admin agit sur la sienne ; un superadmin
  // doit préciser companyId (et elle doit exister).
  private resolveCompanyId(me: JwtUser, bodyCompanyId?: string): string {
    if (me.role === 'superadmin') {
      if (!bodyCompanyId)
        throw new BadRequestException('companyId requis pour un superadmin')
      if (!this.companies.find(bodyCompanyId))
        throw new NotFoundException('Entreprise inconnue')
      return bodyCompanyId
    }
    if (!me.companyId) throw new ForbiddenException('Aucune entreprise associée')
    return me.companyId
  }

  // Récupère un contenu en appliquant l'isolation tenant (404 si autre entreprise).
  private scopedContent(id: string, me: JwtUser): Content {
    const content = this.contents.find(id)
    if (!content) throw new NotFoundException('Contenu inconnu')
    if (me.role !== 'superadmin' && content.companyId !== me.companyId) {
      throw new NotFoundException('Contenu inconnu')
    }
    return content
  }
}
