import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ContentsModule } from '../contents/contents.module'
import { CompaniesModule } from '../companies/companies.module'
import { AdminController } from './admin.controller'

@Module({
  imports: [AuthModule, ContentsModule, CompaniesModule],
  controllers: [AdminController],
})
export class AdminModule {}
