import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CompaniesModule } from '../companies/companies.module'
import { ContentsModule } from '../contents/contents.module'
import { EngineModule } from '../engine/engine.module'
import { UploadController } from './upload.controller'
import { UploadService } from './upload.service'

@Module({
  imports: [AuthModule, ContentsModule, CompaniesModule, EngineModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
