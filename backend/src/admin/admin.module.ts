import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ContentsModule } from '../contents/contents.module'
import { CompaniesModule } from '../companies/companies.module'
import { EmailModule } from '../email/email.module'
import { AdminController } from './admin.controller'

@Module({
  imports: [AuthModule, ContentsModule, CompaniesModule, EmailModule],
  controllers: [AdminController],
})
export class AdminModule {}
