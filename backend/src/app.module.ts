import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { CollabModule } from './collab/collab.module'

@Module({
  imports: [AuthModule, CollabModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
