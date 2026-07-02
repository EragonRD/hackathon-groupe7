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
import { PasswordChangedGuard } from '../auth/password-changed.guard'
import { UsersService } from '../auth/users.service'
import { ContentsService } from '../contents/contents.service'
import { AnalysisService } from '../engine/analysis.service'
import type { RequestWithUser } from '../common/request-context'
import { UploadService } from './upload.service'

const UPLOAD_TMP = join(tmpdir(), 'poulpium-uploads')
const MAX_SIZE = 1024 * 1024 * 1024 // 1 Go

interface UploadedVideo {
  path: string
  originalname: string
  mimetype: string
  size: number
}

// 📤 Upload par un INVITÉ (token role 'guest'). La vidéo est ajoutée à
// l'entreprise de la session et rendue accessible OBLIGATOIREMENT au membre qui
// a invité + aux ADMINS de cette entreprise. L'invité n'a pas de compte : envoi
// « fire-and-forget » (il n'a pas vocation à la revisionner). Chiffrement HLS en
// tâche de fond comme un upload normal.
@UseGuards(AuthGuard, PasswordChangedGuard)
@Controller('contents')
export class GuestUploadController {
  constructor(
    private readonly contents: ContentsService,
    private readonly users: UsersService,
    private readonly upload: UploadService,
    private readonly analysis: AnalysisService,
  ) {}

  @Post('guest-upload')
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
  guestUpload(
    @Req() req: RequestWithUser,
    @UploadedFile() file: UploadedVideo,
    @Body() body: { title?: string },
  ) {
    const me = req.user!
    if (me.role !== 'guest' || !me.companyId) {
      throw new ForbiddenException('Réservé aux invités')
    }
    if (!file) throw new BadRequestException('Aucun fichier reçu')

    const title = body?.title?.trim() || file.originalname
    // Propriétaire = le membre qui a généré l'invitation (auto-autorisé).
    const owner = me.invitedBy ?? me.companyId
    const content = this.contents.createUploaded({
      title,
      companyId: me.companyId,
      ownerUsername: owner,
      guestUpload: true,
    })
    // Accès OBLIGATOIRE aux admins de l'entreprise (en plus de l'invitant).
    for (const u of this.users.listByCompany(me.companyId)) {
      if (u.role === 'admin') this.contents.grantAccess(content.id, u.username)
    }
    // Traitement SÉQUENTIEL (respecte la pipeline, évite la contention CPU/RAM sur
    // le NAS) : 1) chiffrement HLS, PUIS 2) analyse IA (transcription -> traduction).
    // Le fichier clair est supprimé une fois les deux passés (l'Engine a sa copie).
    void (async () => {
      try {
        await this.upload.encryptInBackground(content.id, file.path)
        await this.analysis.startFromFile(content.id, file.path, file.originalname)
      } finally {
        await rm(file.path, { force: true }).catch(() => {})
      }
    })()

    return {
      id: content.id,
      status: 'processing',
      message: "Vidéo envoyée : disponible pour l'équipe après traitement.",
    }
  }

  @Post('guest-upload-chunk')
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
            `${randomBytes(12).toString('hex')}${extname(file.originalname) || '.part'}`,
          ),
      }),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (
          /^video\//.test(file.mimetype) ||
          file.mimetype === 'application/octet-stream'
        )
          cb(null, true)
        else cb(new BadRequestException('Un fichier vidéo est requis (video/*)'), false)
      },
    }),
  )
  async guestUploadChunk(
    @Req() req: RequestWithUser,
    @UploadedFile() file: UploadedVideo,
    @Body()
    body: {
      chunkIndex: string
      totalChunks: string
      uploadId: string
      title?: string
    },
  ) {
    // Null-check EN PREMIER : sans ça, `rm(file.path)` dans la branche d'erreur
    // ci-dessous déréférencerait `file` undefined (TypeError -> 500).
    if (!file) throw new BadRequestException('Aucun chunk reçu')
    const me = req.user!
    if (me.role !== 'guest' || !me.companyId) {
      void rm(file.path, { force: true }).catch(() => {})
      throw new ForbiddenException('Réservé aux invités')
    }

    const chunkIndex = parseInt(body.chunkIndex, 10)
    const totalChunks = parseInt(body.totalChunks, 10)
    const uploadId = body.uploadId

    if (isNaN(chunkIndex) || isNaN(totalChunks) || !uploadId) {
      void rm(file.path, { force: true }).catch(() => {})
      throw new BadRequestException('Paramètres de chunk invalides')
    }

    try {
      const merge = await this.upload.handleChunk(
        file.path,
        chunkIndex,
        totalChunks,
        uploadId,
        file.originalname,
        me.username ?? me.companyId,
      )

      if (merge.completed && merge.path) {
        const title = body?.title?.trim() || file.originalname
        // Propriétaire = le membre qui a généré l'invitation (auto-autorisé).
        const owner = me.invitedBy ?? me.companyId
        const content = this.contents.createUploaded({
          title,
          companyId: me.companyId,
          ownerUsername: owner,
          guestUpload: true,
        })
        // Accès OBLIGATOIRE aux admins de l'entreprise (en plus de l'invitant).
        for (const u of this.users.listByCompany(me.companyId)) {
          if (u.role === 'admin') this.contents.grantAccess(content.id, u.username)
        }

        // Séquentiel (chiffrement PUIS analyse) + vrai nom de fichier transmis.
        const clearPath = merge.path
        void (async () => {
          try {
            await this.upload.encryptInBackground(content.id, clearPath)
            await this.analysis.startFromFile(content.id, clearPath, file.originalname)
          } finally {
            await rm(clearPath, { force: true }).catch(() => {})
          }
        })()

        return {
          id: content.id,
          status: 'processing',
          message: "Vidéo envoyée : disponible pour l'équipe après traitement.",
        }
      }

      return {
        status: 'uploading',
        chunkIndex,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} reçu`,
      }
    } catch (err) {
      void rm(file.path, { force: true }).catch(() => {})
      throw new BadRequestException((err as Error).message)
    }
  }
}
