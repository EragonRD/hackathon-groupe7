import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { SecurityController } from './security.controller'
import { SecurityMiddleware } from './security.middleware'
import { SecurityService } from './security.service'
import { SecuritySelftestService } from './selftest.service'

@Module({
  imports: [AuthModule],
  controllers: [SecurityController],
  providers: [SecurityService, SecurityMiddleware, SecuritySelftestService],
  exports: [SecurityService],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      // /security/ingest est déjà comptabilisé par le contrôleur (auth_request nginx) :
      // on l'exclut du middleware pour ne pas compter chaque segment deux fois.
      .exclude({ path: 'security/ingest', method: RequestMethod.ALL })
      .forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}
