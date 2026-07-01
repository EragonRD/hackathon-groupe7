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
- ~~**Hardening** (si activé) : `issueSession` révoque les refresh tokens précédents du compte.~~
  **RÉVISÉ le 2026-07-01 (commit `55a00fd`)** — voir « Révision » ci-dessous.
- Invités inchangés (pas de `sid` -> guard ignore).

## Révision — reconnexion sans identifiants (2026-07-01, commit `55a00fd`)
### Ce qui change
- `issueSession` **ne révoque plus** les refresh tokens précédents du compte.
- Une session expulsée conserve son refresh token et peut « **Se reconnecter** »
  sans redonner ses identifiants : `reconnect()` (front) relance le refresh, qui
  passe par `issueSession` -> **nouveau `sid` actif** -> ce poste **redevient la
  session active** (et supersède à son tour celui qui l'avait expulsé).
- Front : drapeau `superseded` qui **bloque le refresh AUTOMATIQUE** (heartbeat,
  `authFetch`) ; seul `reconnect()` explicite le débloque. Tokens **conservés**
  au lieu d'être purgés au 401 `session_superseded`.

### Pourquoi
- UX : une expulsion accidentelle (2e onglet ouvert par erreur) se répare en un
  clic, sans ressaisir mot de passe.

### Conséquence sécurité (ASSUMÉE — à connaître pour l'éval Pôle 2 Zero-Trust)
- Le verrou mono-session ne repose **plus que sur le `sid`** de l'access token.
  Les refresh tokens antérieurs restent **valides jusqu'à leur TTL** : une 2e
  session (ou un onglet compromis) peut **reprendre la main** via son refresh
  token tant qu'il n'a pas expiré. « Le dernier login gagne » devient donc « le
  dernier à cliquer *Se reconnecter* gagne ».
- **Boucle de ping-pong** possible : deux postes qui cliquent « Se reconnecter »
  s'expulsent mutuellement en boucle. Atténué (pas supprimé) par le gel du
  heartbeat côté client tant que l'alerte d'expulsion est affichée (`kicked`).

### Si on veut re-durcir (non fait)
- Révoquer les refresh tokens à l'expulsion ET n'autoriser `reconnect()` que via
  le refresh token du poste **courant** (déjà le cas), au prix de perdre la
  reprise après expiration de l'access token.
- Lier le refresh token au `sid` : un refresh ne régénère un access token que si
  son `sid` est encore l'actif -> supprime la reprise silencieuse d'un ancien
  onglet, mais casse aussi la reconnexion volontaire. Arbitrage à trancher.

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
Implémenté et commité (`571c082`). Révisé le 2026-07-01 (`55a00fd`) : reconnexion
sans identifiants — voir section « Révision » (retire la révocation des refresh
tokens, arbitrage sécurité assumé).

## Résumé non-technique
En production, un compte ne peut être ouvert qu'à un seul endroit. Si on se
reconnecte alors que le compte est déjà ouvert ailleurs, l'ancienne session est
fermée automatiquement et affiche « Vous avez été déconnecté par une autre
session. » En développement, rien ne change (on peut toujours ouvrir plusieurs
fenêtres pour la démo).
