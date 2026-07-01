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
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { AuthGuard } from '../auth/auth.guard'
import { AdminGuard } from '../auth/admin.guard'
import { CompanyAdminGuard } from '../auth/company-admin.guard'
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

  // Supprimer une entreprise : CASCADE (ses utilisateurs et ses contenus sont
  // aussi supprimés) pour ne laisser aucun compte/contenu orphelin.
  @UseGuards(SuperAdminGuard)
  @Delete('companies/:id')
  deleteCompany(@Param('id') id: string) {
    const company = this.companies.find(id)
    if (!company) throw new NotFoundException('Entreprise inconnue')
    const usersRemoved = this.users.deleteByCompany(id)
    const contentsRemoved = this.contents.deleteByCompany(id)
    this.companies.delete(id)
    return {
      deleted: company,
      usersRemoved,
      contentsRemoved,
      message: 'Entreprise supprimee (comptes et contenus associes retires)',
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

  // Changer le rôle d'un compte entre 'admin' et 'user' (jamais 'superadmin').
  // Réservé au superadmin ; la cible doit appartenir à une entreprise.
  @UseGuards(SuperAdminGuard)
  @Patch('users/:username/role')
  async setUserRole(
    @Param('username') username: string,
    @Body() body: { role?: string },
  ) {
    if (body?.role !== 'admin' && body?.role !== 'user') {
      throw new BadRequestException("role doit valoir 'admin' ou 'user'")
    }
    const target = await this.users.findByUsername(username)
    if (!target) throw new NotFoundException('Utilisateur inconnu')
    if (target.role === 'superadmin' || !target.companyId) {
      throw new ForbiddenException("Ce compte n'est pas rattache a une entreprise")
    }
    return this.users.setRole(username, body.role)
  }

  // Supprimer un compte : superadmin = n'importe qui (sauf lui-même) ;
  // admin = uniquement les comptes de SON entreprise (sauf lui-même).
  @UseGuards(AdminGuard)
  @Delete('users/:username')
  async deleteUser(@Req() req: RequestWithUser, @Param('username') username: string) {
    const me = req.user!
    if (username === me.username) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer votre propre compte')
    }
    const target = await this.users.findByUsername(username)
    if (!target) throw new NotFoundException('Utilisateur inconnu')
    if (me.role !== 'superadmin') {
      // Un admin d'entreprise ne peut agir que dans SA société, jamais sur un superadmin.
      if (target.role === 'superadmin' || target.companyId !== me.companyId) {
        throw new NotFoundException('Utilisateur inconnu')
      }
    }
    this.users.deleteUser(username)
    return { deleted: username }
  }

  // Contenus : réservés aux ADMINS D'ENTREPRISE. Le superadmin n'y a AUCUN accès
  // (CompanyAdminGuard le refuse) ; chaque admin ne voit que SON entreprise.
  @UseGuards(CompanyAdminGuard)
  @Get('contents')
  listContents(@Req() req: RequestWithUser) {
    return this.contents.listByCompany(req.user!.companyId ?? null)
  }

  @UseGuards(CompanyAdminGuard)
  @Post('contents')
  createContent(
    @Req() req: RequestWithUser,
    @Body() body: { title?: string },
  ) {
    if (!body?.title) throw new BadRequestException('title requis')
    const companyId = req.user!.companyId
    if (!companyId) throw new ForbiddenException('Aucune entreprise associee')
    return this.contents.create({ title: body.title, companyId })
  }

  @UseGuards(CompanyAdminGuard)
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

  @UseGuards(CompanyAdminGuard)
  @Delete('contents/:id/access/:username')
  revokeAccess(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('username') username: string,
  ) {
    this.scopedContent(id, req.user!)
    return this.contents.revokeAccess(id, username)
  }

  @UseGuards(CompanyAdminGuard)
  @Post('contents/:id/revoke')
  revokeKey(@Req() req: RequestWithUser, @Param('id') id: string) {
    this.scopedContent(id, req.user!)
    const content = this.contents.setRevoked(id, true)
    return { ...content, message: 'Cle revoquee : delivrance bloquee' }
  }

  @UseGuards(CompanyAdminGuard)
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
  // Appelé uniquement par des admins d'entreprise (CompanyAdminGuard).
  private scopedContent(id: string, me: JwtUser): Content {
    const content = this.contents.find(id)
    if (!content) throw new NotFoundException('Contenu inconnu')
    if (content.companyId !== me.companyId) {
      throw new NotFoundException('Contenu inconnu')
    }
    return content
  }
}
