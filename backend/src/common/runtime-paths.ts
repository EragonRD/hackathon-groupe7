import { existsSync } from 'fs'
import { join } from 'path'

export function backendPath(...parts: string[]): string {
  const cwd = process.cwd()

  if (existsSync(join(cwd, 'backend', 'package.json'))) {
    return join(cwd, 'backend', ...parts)
  }

  return join(cwd, ...parts)
}
