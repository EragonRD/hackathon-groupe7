# Feature — Mono-session (un seul compte connecté à la fois)

## Contexte
En production, un même compte ne doit avoir **qu'une seule session active**. Si
quelqu'un se reconnecte avec le compte déjà ouvert ailleurs, **le dernier gagne** :
la session précédente est expulsée et voit le message
« Vous avez été déconnecté par une autre session. »

## Objectif
- Une session vivante par compte (en prod).
- Le nouveau login supersède l'ancien.
- L'ancien client est déconnecté et informé clairement.
- Aucun impact sur la démo dev multi-fenêtres (même compte) ni sur les invités.

## Constats (code existant)
- JWT payload : `{ sub, username, role, companyId, mustChangePassword }` — **pas de session id**.
- `AuthService.issueSession()` centralise l'émission (login / changePassword / refresh).
- `AuthGuard` ne vérifie que signature + expiration (stateless).
- TTL JWT court (15m). Refresh tokens révocables déjà en mémoire (mais accumulés).
- Front : `authFetch` intercepte tout 401 -> `logout()` + event `auth:expired` (message générique).
- Invités : tokens émis hors `issueSession` (contents/keys), sans `sid`, `role='guest'`.

## Décisions
- **Session id (`sid`)** aléatoire ajouté au JWT à chaque `issueSession`. Le serveur
  garde `sub -> sid actif` (`SessionService`, en mémoire). Dernière émission = active.
- **Enforcement prod-only** : `MONO_SESSION` (`true|false`) sinon `NODE_ENV==='production'`.
- **Fail-open** si aucun `sid` enregistré (redémarrage) : on n'expulse pas sans preuve
  d'une session plus récente.
- **Guard** : `sid` présent + != actif -> `401 'session_superseded'`.
- **Front** : `authFetch` distingue `session_superseded` du 401 normal (expiration) et
  propage la raison ; **heartbeat** `/auth/me` (15 s) pour l'expulsion des sessions inactives.
- **Hardening** (si activé) : `issueSession` révoque les refresh tokens précédents du compte.
- Invités inchangés (pas de `sid` -> guard ignore).

## Risques
- **Redémarrage serveur** : sessions superseded avant redémarrage redeviennent valides
  jusqu'à leur expiration (15m) — accepté (fail-open). Persistance possible si besoin.
- **Heartbeat** : +4 req/min/compte sur `/auth/me` (sous les seuils anti-abus P2-B).
- **WebSocket review** : le socket n'est pas coupé directement ; l'expulsion HTTP
  (heartbeat) démonte `VideoReview` -> le socket se ferme indirectement. À durcir si besoin.
- **Same-account multi-fenêtres en prod** : volontairement cassé (c'est le but).

## Plan d'action
- [x] `SessionService` (registre `sub -> sid`, flag prod, fail-open) — backend/src/auth/session.service.ts
- [x] `AuthModule` : provide + export `SessionService`
- [x] `AuthService.issueSession` : génère `sid`, `setActive`, révoque anciens refresh (si activé)
- [x] `AuthGuard` : injecte `SessionService`, refuse `session_superseded`
- [x] Specs backend : constructeurs mis à jour + cas supersession
- [x] Front `auth.js` : parse la raison du 401, event `auth:expired` détaillé
- [x] Front `App.jsx` : heartbeat + bandeau de notification -> Login
- [x] Front `Login.jsx` : bandeau « déconnecté par une autre session »
- [x] Lint + tests (jest / vitest)

## Avancement
Implémenté. Voir Résumé ci-dessous. Non commité (validation requise).

## Résumé non-technique
En production, un compte ne peut être ouvert qu'à un seul endroit. Si on se
reconnecte alors que le compte est déjà ouvert ailleurs, l'ancienne session est
fermée automatiquement et affiche « Vous avez été déconnecté par une autre
session. » En développement, rien ne change (on peut toujours ouvrir plusieurs
fenêtres pour la démo).
