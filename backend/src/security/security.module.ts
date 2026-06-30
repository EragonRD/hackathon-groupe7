import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { SecurityController } from './security.controller'
import { SecurityMiddleware } from './security.middleware'
import { SecurityService } from './security.service'

@Module({
  imports: [AuthModule],
  controllers: [SecurityController],
  providers: [SecurityService, SecurityMiddleware],
  exports: [SecurityService],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}
