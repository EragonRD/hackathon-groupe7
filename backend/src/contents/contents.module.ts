import { Module } from '@nestjs/common'
import { ContentsService } from './contents.service'

@Module({
  providers: [ContentsService],
  exports: [ContentsService],
})
export class ContentsModule {}
