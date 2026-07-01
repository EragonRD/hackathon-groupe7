import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CompaniesModule } from '../companies/companies.module'
import { ContentsModule } from '../contents/contents.module'
import { UploadController } from './upload.controller'
import { UploadService } from './upload.service'

@Module({
  imports: [AuthModule, ContentsModule, CompaniesModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
