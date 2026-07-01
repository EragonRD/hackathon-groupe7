import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { randomBytes } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { rm } from 'fs/promises'
import { diskStorage } from 'multer'
import { tmpdir } from 'os'
import { extname, join } from 'path'
import { AuthGuard } from '../auth/auth.guard'
import { AdminGuard } from '../auth/admin.guard'
import { PasswordChangedGuard } from '../auth/password-changed.guard'
import { CompaniesService } from '../companies/companies.service'
import { ContentsService } from '../contents/contents.service'
import { AnalysisService } from '../engine/analysis.service'
import type { RequestWithUser } from '../common/request-context'
import { UploadService } from './upload.service'

const UPLOAD_TMP = join(tmpdir(), 'poulpium-uploads')
const MAX_SIZE = 1024 * 1024 * 1024 // 1 Go

// Type minimal du fichier Multer (évite la dépendance @types/multer côté import).
interface UploadedVideo {
  path: string
  originalname: string
  mimetype: string
  size: number
}

// 📤 Upload d'une vidéo → chiffrement HLS async. Admin only, scoppé entreprise.
@UseGuards(AuthGuard, PasswordChangedGuard, AdminGuard)
@Controller('admin/contents')
export class UploadController {
  constructor(
    private readonly contents: ContentsService,
    private readonly companies: CompaniesService,
    private readonly upload: UploadService,
    private readonly analysis: AnalysisService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(UPLOAD_TMP)) mkdirSync(UPLOAD_TMP, { recursive: true })
          cb(null, UPLOAD_TMP)
        },
        filename: (_req, file, cb) =>
          cb(
            null,
            `${randomBytes(12).toString('hex')}${extname(file.originalname) || '.mp4'}`,
          ),
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (/^video\//.test(file.mimetype)) cb(null, true)
        else cb(new BadRequestException('Un fichier vidéo est requis (video/*)'), false)
      },
    }),
  )
  uploadVideo(
    @Req() req: RequestWithUser,
    @UploadedFile() file: UploadedVideo,
    @Body() body: { title?: string; companyId?: string },
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu')
    const me = req.user!

    // Entreprise cible : un admin agit sur la sienne ; un superadmin précise companyId.
    let companyId: string
    if (me.role === 'superadmin') {
      if (!body?.companyId || !this.companies.find(body.companyId)) {
        throw new BadRequestException('companyId valide requis (superadmin)')
      }
      companyId = body.companyId
    } else {
      if (!me.companyId) throw new ForbiddenException('Aucune entreprise associée')
      companyId = me.companyId
    }

    const title = body?.title?.trim() || file.originalname
    const content = this.contents.createUploaded({
      title,
      companyId,
      ownerUsername: me.username,
    })
    // Deux consommateurs lisent le MÊME fichier temporaire clair, en parallèle :
    //  - l'Engine (analyse IA), qui streame le fichier (openAsBlob, lecture paresseuse) ;
    //  - le chiffrement HLS, qui le ré-encode.
    // Le fichier ne doit être SUPPRIMÉ qu'une fois que LES DEUX ont fini de le lire :
    // sinon un rm prématuré (chiffrement rapide) casse le stream de l'Engine
    // (ENOENT) et l'analyse échoue silencieusement. On coordonne donc la suppression.
    const analysisSent = this.analysis.startFromFile(content.id, file.path)
    const encoded = this.upload.encryptInBackground(content.id, file.path)
    void Promise.allSettled([analysisSent, encoded]).finally(() => {
      void rm(file.path, { force: true }).catch(() => {})
    })

    return {
      ...content,
      message: 'Upload reçu — chiffrement en cours (statut: processing)',
    }
  }
}
