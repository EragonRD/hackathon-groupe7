import { Module } from '@nestjs/common'
import { ReviewGateway } from './review.gateway'

// Module du relais temps réel de revue. JwtService est fourni globalement par
// AuthModule (JwtModule.register({ global: true })) -> rien d'autre à importer.
@Module({
  providers: [ReviewGateway],
})
export class ReviewModule {}
