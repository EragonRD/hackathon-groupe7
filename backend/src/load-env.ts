import { config } from 'dotenv'
import { existsSync } from 'fs'
import { join } from 'path'

// Charge les variables d'environnement depuis les fichiers .env AVANT que les
// modules (ex. AuthModule) ne lisent process.env. dotenv n'écrase jamais une
// variable déjà définie : priorité = env du process > .env racine > backend/.env.
// Doit être importé en TOUT PREMIER dans main.ts.
const cwd = process.cwd()
const candidates = [
  join(cwd, '.env'), // lancé depuis la racine, ou racine montée en Docker
  join(cwd, '..', '.env'), // lancé depuis backend/ -> .env de la racine
  join(cwd, 'backend', '.env'), // lancé depuis la racine -> backend/.env
  join(cwd, '.env.local'),
]

for (const path of candidates) {
  if (existsSync(path)) config({ path, quiet: true })
}
