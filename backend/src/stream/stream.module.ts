import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { StreamController } from './stream.controller'
import { StreamService } from './stream.service'

@Module({
  imports: [SecurityModule],
  controllers: [StreamController],
  providers: [StreamService],
})
export class StreamModule {}
