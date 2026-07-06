import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
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
import { dirname, extname, join } from 'path'
import { AuthGuard } from '../auth/auth.guard'
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

// 📤 Upload d'une vidéo → chiffrement HLS async. Ouvert à TOUT membre authentifié
// (user/admin/superadmin), scopé à SON entreprise : le contenu est créé dans la
// companyId de l'appelant (superadmin : companyId explicite) et l'uploader est
// auto-autorisé. Pas d'AdminGuard : un simple utilisateur peut contribuer une vidéo.
@UseGuards(AuthGuard, PasswordChangedGuard)
@Controller('admin/contents')
export class UploadController {
  constructor(
    private readonly contents: ContentsService,
    private readonly companies: CompaniesService,
    private readonly upload: UploadService,
    private readonly analysis: AnalysisService,
  ) {}

  // 🔁 (Re)lance l'analyse IA d'un contenu DÉJÀ uploadé/chiffré, dont la source
  // claire n'existe plus. On reconstruit l'audio depuis le HLS chiffré (le Core a
  // la clé + ffmpeg) puis on démarre l'analyse. Idempotent : refuse si déjà en
  // cours ou terminée. Accès : membre de l'entreprise autorisé sur ce contenu.
  @Post(':id/analyze')
  async analyzeExisting(@Req() req: RequestWithUser, @Param('id') id: string) {
    const me = req.user!
    const content = this.contents.find(id)
    // Cross-tenant / inexistant : 404 (on ne révèle rien), même règle que /keys.
    if (!content || content.companyId !== me.companyId) {
      throw new NotFoundException('Contenu introuvable')
    }
    if (!this.contents.isAllowed(id, me)) {
      throw new ForbiddenException('Accès refusé pour ce contenu')
    }

    const rec = this.analysis.get(id)
    if (rec && (rec.status === 'processing' || rec.status === 'done')) {
      return { status: rec.status, message: 'analyse déjà en cours ou terminée' }
    }

    // Reconstruit l'audio depuis le HLS chiffré, lance l'analyse, puis nettoie.
    const audioPath = await this.upload.extractAudioFromHls(id)
    try {
      await this.analysis.startFromFile(id, audioPath, `${content.title}.mp4`)
    } finally {
      await rm(dirname(audioPath), { recursive: true, force: true }).catch(() => {})
    }
    return { status: 'processing' }
  }

  // 🔁 Relance le CHIFFREMENT d'un contenu dont le chiffrement a échoué ('failed'),
  // à partir de la source claire conservée. 400 si la source n'existe plus.
  @Post(':id/reencrypt')
  async reencryptExisting(@Req() req: RequestWithUser, @Param('id') id: string) {
    const me = req.user!
    const content = this.contents.find(id)
    if (!content || content.companyId !== me.companyId) {
      throw new NotFoundException('Contenu introuvable')
    }
    if (!this.contents.isAllowed(id, me)) {
      throw new ForbiddenException('Accès refusé pour ce contenu')
    }
    if (content.status !== 'failed') {
      return { status: content.status, message: "le contenu n'est pas en échec" }
    }
    const ok = await this.upload.reencrypt(id)
    if (!ok) {
      throw new BadRequestException(
        'Source indisponible pour la relance — ré-uploadez la vidéo.',
      )
    }
    return { status: 'processing' }
  }

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
    // Traitement SÉQUENTIEL (respecte la pipeline et évite la contention CPU/RAM
    // sur un NAS modeste) : 1) chiffrement HLS, PUIS 2) analyse IA (transcription
    // -> traduction). Le fichier clair est supprimé une fois les deux passés
    // (l'Engine ayant reçu sa propre copie au moment de startFromFile).
    // Pipeline unifié : chiffrement + (analyse / conservation de la source si échec).
    void this.upload.finalizeUpload(content.id, file.path, file.originalname)

    return {
      ...content,
      message: 'Upload reçu — chiffrement en cours (statut: processing)',
    }
  }

  @Post('upload-chunk')
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
  async uploadChunk(
    @Req() req: RequestWithUser,
    @UploadedFile() file: UploadedVideo,
    @Body()
    body: {
      chunkIndex: string
      totalChunks: string
      uploadId: string
      title?: string
      companyId?: string
    },
  ) {
    if (!file) throw new BadRequestException('Aucun chunk reçu')
    const me = req.user!

    // Entreprise cible résolue et VALIDÉE en amont (dès le 1er chunk) : inutile de
    // laisser un upload complet se dérouler pour rejeter ensuite un companyId absent.
    let companyId: string
    if (me.role === 'superadmin') {
      if (!body?.companyId || !this.companies.find(body.companyId)) {
        void rm(file.path, { force: true }).catch(() => {})
        throw new BadRequestException('companyId valide requis (superadmin)')
      }
      companyId = body.companyId
    } else {
      if (!me.companyId) {
        void rm(file.path, { force: true }).catch(() => {})
        throw new ForbiddenException('Aucune entreprise associée')
      }
      companyId = me.companyId
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
        me.username,
      )

      if (merge.completed && merge.path) {
        const title = body?.title?.trim() || file.originalname
        const content = this.contents.createUploaded({
          title,
          companyId,
          ownerUsername: me.username,
        })

        // Pipeline unifié : chiffrement + (analyse / conservation si échec).
        void this.upload.finalizeUpload(content.id, merge.path, file.originalname)

        return {
          ...content,
          message: 'Upload complet et reçu — chiffrement en cours (statut: processing)',
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
