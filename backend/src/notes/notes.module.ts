import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ContentsModule } from '../contents/contents.module'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'

// Persistance serveur des notes de revue. S'appuie sur AuthModule (AuthGuard) et
// ContentsModule (contrôle d'accès par contenu).
@Module({
  imports: [AuthModule, ContentsModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
