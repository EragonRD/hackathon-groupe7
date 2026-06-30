import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ContentsModule } from '../contents/contents.module'
import { AdminController } from './admin.controller'

@Module({
  imports: [AuthModule, ContentsModule],
  controllers: [AdminController],
})
export class AdminModule {}
