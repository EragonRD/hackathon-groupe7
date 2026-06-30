import './load-env' // DOIT rester en premier : charge les .env avant tout le reste
import { existsSync } from 'fs'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { backendPath } from './common/runtime-paths'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // 🔐 Confiance proxy : on ne fait confiance au header X-Forwarded-For QUE s'il
  // provient d'un proxy de confiance (loopback + réseaux privés = nginx en local
  // ou Docker). Un client externe direct ne peut donc PAS usurper son IP.
  //   • démo locale : les scripts tapent depuis 127.0.0.1 (loopback) -> XFF honoré.
  //   • Docker      : nginx est sur un réseau privé (uniquelocal) -> XFF honoré.
  //   • prod        : régler TRUST_PROXY sur le SEUL sous-réseau du reverse-proxy.
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, uniquelocal')

  // Hackathon : on autorise le front (Vite) à appeler l'API. À restreindre en prod.
  app.enableCors({
    origin: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'Range', 'X-Forwarded-For'],
    exposedHeaders: ['Content-Length', 'Content-Range'],
  })

  const publicDir = backendPath('public')
  if (existsSync(publicDir)) {
    app.useStaticAssets(publicDir)
  }

  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
