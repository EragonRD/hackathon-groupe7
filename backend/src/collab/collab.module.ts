import { Module } from '@nestjs/common'
import { CollabGateway } from './collab.gateway'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  providers: [CollabGateway],
})
export class CollabModule {}
