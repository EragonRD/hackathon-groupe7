import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { KeysModule } from './keys/keys.module'
import { SecurityModule } from './security/security.module'
import { ReviewModule } from './review/review.module'
import { AdminModule } from './admin/admin.module'
import { StreamModule } from './stream/stream.module'
import { UploadModule } from './upload/upload.module'
import { EngineModule } from './engine/engine.module'
import { NotesModule } from './notes/notes.module'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AuthModule,
    KeysModule,
    SecurityModule,
    ReviewModule,
    AdminModule,
    StreamModule,
    UploadModule,
    EngineModule,
    NotesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
