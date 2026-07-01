import { Injectable } from '@nestjs/common'

// Active la mono-session en PROD par défaut ; override explicite via MONO_SESSION.
// En dev/test on laisse plusieurs sessions (démo multi-fenêtres du même compte).
function monoSessionEnabled(): boolean {
  const flag = process.env.MONO_SESSION
  if (flag !== undefined) return flag === 'true' || flag === '1'
  return process.env.NODE_ENV === 'production'
}

// Registre des sessions actives : une seule session vivante par compte.
// Le JWT porte un `sid` ; on retient `sub -> sid actif`. La DERNIÈRE émission
// (login / refresh / changement de mot de passe) gagne ; les tokens portant un
// `sid` plus ancien sont refusés par l'AuthGuard.
//
// En mémoire volontairement : au redémarrage le registre est vide -> fail-open
// (on ne peut pas prouver qu'une session plus récente existe, on n'expulse pas).
@Injectable()
export class SessionService {
  private readonly active = new Map<number, string>()
  private readonly enforce: boolean

  // `enabled` sert aux tests ; en DI Nest l'appelle sans argument (-> env).
  constructor(enabled?: boolean) {
    this.enforce = enabled ?? monoSessionEnabled()
  }

  get enabled(): boolean {
    return this.enforce
  }

  // Enregistre la session courante d'un compte (émission d'un nouveau token).
  setActive(sub: number, sid: string): void {
    this.active.set(sub, sid)
  }

  // Le token présenté porte-t-il la session la plus récente pour ce compte ?
  // - enforcement désactivé (dev) -> toujours vrai.
  // - aucun enregistrement (redémarrage) -> fail-open (vrai).
  isCurrent(sub: number, sid: string): boolean {
    if (!this.enforce) return true
    const current = this.active.get(sub)
    if (current === undefined) return true
    return current === sid
  }

  // Oublie la session d'un compte (utilitaire ; non appelé au logout pour éviter
  // de « ressusciter » une ancienne session via le fail-open).
  clear(sub: number): void {
    this.active.delete(sub)
  }
}
