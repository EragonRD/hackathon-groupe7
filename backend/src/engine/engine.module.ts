import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ContentsModule } from '../contents/contents.module'
import { AnalysisService } from './analysis.service'
import { EngineController } from './engine.controller'
import { EngineService } from './engine.service'

@Module({
  imports: [AuthModule, ContentsModule],
  controllers: [EngineController],
  providers: [EngineService, AnalysisService],
  exports: [AnalysisService],
})
export class EngineModule {}
