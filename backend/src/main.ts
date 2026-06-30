import { existsSync } from 'fs'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { backendPath } from './common/runtime-paths'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
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
