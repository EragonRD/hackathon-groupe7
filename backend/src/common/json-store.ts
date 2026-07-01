import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { backendPath } from './runtime-paths'

// Persistance fichier simple (démo mono-process) pour les données métier
// multi-tenant : users, companies, contents. Réutilise le même emplacement que
// les logs/secrets (sous backend/, ou /app en Docker) via backendPath().
//
// Écriture ATOMIQUE (fichier temporaire + renommage) : un crash en plein write
// ne corrompt jamais le fichier existant. Lecture tolérante : fichier absent ou
// illisible => on repart du fallback (le seed).
//
// Pas de verrou de concurrence : suffisant pour un seul process. Ne pas utiliser
// tel quel en multi-instance.

function dataFile(name: string): string {
  return backendPath('data', name)
}

export function loadJson<T>(name: string, fallback: T): T {
  const file = dataFile(name)
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function saveJson(name: string, data: unknown): void {
  const file = dataFile(name)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = join(dirname(file), `.${name}.tmp`)
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tmp, file)
}
