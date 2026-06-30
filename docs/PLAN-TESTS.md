# Plan de tests — Poulpium (destiné à Codex)

> **Pour qui** : Codex, qui implémente les tests.
> **Qui relit** : Claude, qui review l'implémentation contre ce plan.
> **Registre** : on écrit des tests qui *attrapent des régressions réelles*, pas des
> tests qui font monter un % de couverture. Lis la section 0 avant d'écrire une ligne.

---

## 0. Règle du jeu : ce qu'est un test « non édulcoré »

Un test est accepté seulement s'il respecte les 4 critères :

1. **Il protège un invariant nommé.** Chaque `describe`/`it` doit pouvoir se résumer
   en une phrase « si quelqu'un casse X, ce test rougit ». Si tu ne sais pas quel bug
   le test attrape, ne l'écris pas.
2. **Il échouerait si on retirait la protection** (test de mutation mental). Avant de
   valider un test, demande-toi : « si je supprime la ligne de code qu'il vise, est-ce
   que le test casse ? » Si non, le test est décoratif → poubelle.
3. **Il teste le comportement, pas l'implémentation.** On assert des entrées→sorties et
   des effets observables, pas l'ordre interne des appels (sauf quand l'appel *est*
   l'invariant de sécurité, cf. anti-énumération).
4. **Il est déterministe.** Pas de `Date.now()` réel non maîtrisé, pas de `setTimeout`
   réel, pas d'assertion sur des durées wall-clock (flaky). On injecte le temps.

### Anti-patterns interdits (= « édulcoré »)

- ❌ `expect(result).toBeTruthy()` / `toBeDefined()` comme seule assertion.
- ❌ Snapshots de gros objets (`toMatchSnapshot`) : ça fige le bug avec le code.
- ❌ Mocker la fonction qu'on teste, ou mocker si profondément qu'on teste le mock.
- ❌ Tester un getter trivial / un type / une constante.
- ❌ `try/catch` autour de l'assert qui avale l'échec.
- ❌ Un seul cas « happy path » par fonction alors qu'il y a des branches d'erreur.
- ❌ Assertion sur un message d'erreur en français exact (fragile) → assert le **type**
  d'exception (`UnauthorizedException`, `ForbiddenException`, `NotFoundException`) et le
  **code HTTP**, pas la chaîne.

### Priorisation

| Priorité | Cible | Pourquoi |
|---|---|---|
| **P0** | `auth.service`, `auth.guard`, `keys.service`, `security.service` | Surface sécurité. Un bug ici = faille réelle. |
| **P1** | `format.js`, `collab.js` (contrat transport) | Logique pure, ROI immédiat, base du temps réel. |
| **P2** | `review.gateway`, `useReview.js` | Intégration / hook React. Plus coûteux à monter, valeur réelle mais après les P0/P1. |

Fais **tous les P0 d'abord** et fais-les bien. Mieux vaut 4 fichiers P0 solides que 9
fichiers superficiels.

---

## 1. Outillage à mettre en place

### 1.1 Backend (`backend/`) — déjà prêt

Jest + ts-jest + supertest sont installés et configurés (`package.json` → bloc `jest`,
`testRegex: .*\.spec\.ts$`, `rootDir: src`). **Ne touche pas à la config.**

- Les specs vont à côté du code : `src/<module>/<fichier>.spec.ts`.
- Commande : `cd backend && npm test`. Couverture : `npm run test:cov`.
- ⚠️ **À vérifier en premier** (cf. §6) : `argon2` est un module natif. Lance
  `npm test` sur le spec existant *avant* d'écrire quoi que ce soit, pour confirmer
  que le binding compile dans cet environnement. Si argon2 ne charge pas, signale-le —
  on adaptera la stratégie (mock partiel) au lieu de bricoler.

### 1.2 Frontend (`frontend/`) — tout à installer

Rien n'existe. Ajoute en `devDependencies` :

```
vitest  @vitest/coverage-v8  jsdom  @testing-library/react  @testing-library/jest-dom
```

- Crée `frontend/vitest.config.js` : `environment: 'jsdom'`, `globals: true`,
  `setupFiles` pointant un `src/test/setup.js` qui importe `@testing-library/jest-dom`.
- Ajoute les scripts dans `frontend/package.json` :
  `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:cov": "vitest run --coverage"`.
- Les tests vont en `src/**/<nom>.test.js(x)`.
- **Respecte le lint du repo** : LF, prettier, eslint. Lance `npm run lint` avant de finir.
- N'introduis **aucune** autre dépendance (le projet revendique « zéro dépendance réseau »).

---

## 2. Backend — cibles, invariants, cas

Pour chaque fichier : la liste des cas est un **minimum**, pas un plafond. Chaque ligne
`→` est l'invariant protégé.

### 2.1 `auth/auth.service.spec.ts` (P0)

Setup : instancie `AuthService` avec un vrai `JwtService` (clé de test) et un
`UsersService` réel (appelle `onModuleInit()` pour hasher les seeds) **ou** un faux
`UsersService` qui renvoie un user avec un `passwordHash` argon2 réel pré-calculé.
Utilise `jest.useFakeTimers()` + `jest.setSystemTime()` pour piloter le lockout.

Cas :
- Login valide → renvoie `{ accessToken, user }`, et le token décodé contient
  `sub/username/role` corrects. → *le payload JWT est bien formé*.
- Mauvais mot de passe → `UnauthorizedException`. → *refus*.
- Utilisateur inexistant → `UnauthorizedException` (même type que mauvais mdp).
  → *pas de fuite « compte inexistant vs mauvais mdp »*.
- **Anti-énumération (invariant clé)** : espionne `argon2.verify`
  (`jest.spyOn(argon2,'verify')`) et vérifie qu'il est appelé **même pour un user
  inconnu** (avec le `DUMMY_HASH`). → *le chemin temps-constant n'est pas court-circuité*.
  ⚠️ N'assert **pas** une durée en ms (flaky) ; assert l'**appel**.
- **Lockout** : 5 échecs consécutifs → le 6e renvoie `429 TOO_MANY_REQUESTS`
  **sans** appeler `argon2.verify` (le compte est refusé avant test du mot de passe —
  vérifie via le spy que verify n'est PAS rappelé sur la tentative verrouillée).
  → *le verrou court-circuite bien la vérification*.
- **Fenêtre de verrou** : après lockout, avance le temps de `> LOCK_MS` (5 min) →
  une nouvelle tentative est de nouveau évaluée (plus 429). → *le verrou expire*.
- **Reset au succès** : 4 échecs puis 1 succès → le compteur retombe ; 4 nouveaux
  échecs ne déclenchent pas le verrou. → *`attempts.delete` au succès*.
- **Borne exacte** : 4 échecs ne verrouillent pas, le 5e oui (le code teste
  `fails >= MAX_FAILS`). Teste explicitement 4 vs 5.

### 2.2 `auth/auth.guard.spec.ts` (P0)

Setup : `new AuthGuard(jwt)` avec un vrai `JwtService`. Fabrique un faux
`ExecutionContext` qui renvoie un `req` avec `headers.authorization`.

Cas :
- Header absent → `UnauthorizedException('Token manquant')` (assert le **type**).
- Header sans préfixe `Bearer ` → rejet (token resté `undefined`).
- Token signé valide → `canActivate` renvoie `true` ET `req.user` est peuplé avec le
  payload. → *le guard attache l'identité*.
- Token expiré → rejet. → *l'expiration est honorée*.
- **Confusion d'algorithme (invariant clé)** : forge un token signé en `none` ou
  cosigné autrement, et un token signé HS256 mais que `verifyAsync` doit refuser hors
  `algorithms:['HS256']`. Le minimum exploitable : vérifie qu'un token dont l'`alg`
  n'est pas HS256 est **rejeté**. → *l'épinglage `algorithms:['HS256']` bloque la
  confusion d'algo*. Si forger un tel token est trop lourd, documente-le et teste au
  moins qu'un token signé avec une **autre clé** est rejeté.

### 2.3 `keys/keys.service.spec.ts` (P0)

Setup : `new KeysService()`. Les chemins viennent de `backendPath(...)`. Tu auras
besoin de contrôler le système de fichiers : préfère **mocker `fs/promises`**
(`jest.mock('fs/promises')`) pour `readFile`/`appendFile`/`mkdir` afin de ne pas
dépendre de vrais fichiers `secrets/*.key`. `JwtUser` = objet simple `{ sub, username }`.

Cas (l'ordre des contrôles EST l'invariant de sécurité) :
- **Traversée de chemin (invariant clé)** : `contentId = '../../etc/passwd'` (et
  variantes : `..\\..`, `poc/../poc`, majuscules, point initial) → `NotFoundException`,
  et `readFile` **n'est jamais appelé**. → *l'id est validé AVANT toute construction de
  chemin* (le regex `CONTENT_ID_PATTERN`).
- **ACL deny-by-default** : `contentId='poc'` mais user `mallory` (hors ACL) →
  `ForbiddenException`, et `readFile` **jamais appelé**. → *refus avant lecture disque*.
- **Contenu inconnu** : `contentId='inconnu'` (valide au regex, absent de l'ACL) →
  `ForbiddenException` (ACL vide = `[]`). → *deny-by-default sur contenu non déclaré*.
- **Clé absente** : user autorisé + contentId valide mais `readFile` rejette (ENOENT)
  → `NotFoundException`. → *erreur disque ne fuit pas en 500*.
- **Succès** : user `alice` + `poc` + `readFile` renvoie un Buffer → renvoie ce Buffer.
- **Journalisation** : sur refus comme sur succès, `appendFile` est appelé avec une
  ligne JSON contenant `result` (`denied`/`granted`) et `reason` cohérents. → *audit
  trail présent* (chaque branche logge le bon `reason` : `invalid_content_id`,
  `content_acl_denied`, `key_not_found`, `content_acl_granted`).

### 2.4 `security/security.service.spec.ts` (P0 — la cible la plus riche)

`recordRequest` accepte `tsMs` → **temps 100 % déterministe, aucun fake timer requis**.
Setup : `new SecurityService()`. **N'appelle pas `onModuleInit`** (il lit un fichier
proxy) sauf pour le test proxy dédié ; sinon `proxyNetworks` reste `[]`, c'est voulu.
⚠️ `createAlert` fait `appendFile`/`mkdir` réels → **mocke `fs/promises`** pour éviter
d'écrire dans `logs/`.

Cas :
- **Multi-session, borne exacte** : pour un même `account`, envoie des requêtes depuis
  3 IP distinctes dans la fenêtre → **pas** d'alerte ; la 4e IP distincte (seuil est
  `> 3`) → alerte `multi_session`. Teste 3 (rien) vs 4 (alerte). → *le seuil `>` est
  respecté, pas un `>=` accidentel*.
- **Fenêtre glissante** : 3 IP anciennes (`tsMs` hors `WINDOW_MS`) + 1 récente →
  pas d'alerte, car les anciennes sont sorties de la fenêtre via `trim`/`distinctIps`.
  → *le sliding window expire vraiment*.
- **Scrape de segments .ts — escalade flag→block** :
  - `≤ 8` requêtes `.ts` dans 60 s → aucune alerte (seuil alerte `> 8`).
  - `9..20` → alerte `segment_scrape` action `flag`, `blocked=false`.
  - `> 20` → alerte action `block`, **`blocked=true`**. → *le blocage se déclenche au
    bon seuil* (teste 20 = flag, 21 = block).
- **Détection `.ts`** : `isSegmentRequest` via `recordRequest` — `/seg1.ts` compte,
  `/seg1.ts?token=x` compte (le regex gère `[?#]`), `/report.tsx` **ne compte pas**,
  `/a.ts/b` ne compte pas. → *le regex ne sur-déclenche pas sur du tsx*.
- **Acteur = account sinon IP** : sans `account`, le comptage segment se fait par IP.
  → *un anonyme qui scrappe est quand même attrapé*.
- **Dédoublonnage d'alerte** : deux requêtes identiques déclenchant la même alerte à
  `< ALERT_DEDUPE_MS` (30 s) → **une seule** alerte. À `> 30 s` → deux. → *le dédup
  évite le spam*.
- **Escalade non avalée par le dédup (subtil, invariant clé)** : une alerte `flag`
  puis, peu après (< 30 s), une escalade `block` sur le même type/account/ip →
  **les deux** sont émises, car l'`action` fait partie de la clé de dédup. → *un blocage
  reste visible même juste après un flag*.
- **Proxy / CIDR** (`findProxyMatch` + `parseProxyNetwork` + `ipv4ToNumber`) : c'est de
  l'arithmétique binaire, terrain à bugs. Charge une liste proxy de test (mocke
  `readFile` dans `loadProxyList`, puis `onModuleInit`) avec p.ex. `10.0.0.0/8` :
  - `10.1.2.3` matche → alerte `proxy_ip`.
  - `11.0.0.1` ne matche pas.
  - `/32` matche une IP exacte et pas sa voisine.
  - `/0` matche tout.
  - IP invalide (`999.1.1.1`, `1.2.3`, `abc`) → `ipv4ToNumber` renvoie `undefined`,
    pas de match, pas de crash.
  - `::ffff:10.0.0.1` (IPv4-mapped) est normalisée et matche. `::1` → `127.0.0.1`.
  → *le masque CIDR est correct sur les bornes*.
- **Plafond mémoire** : `MAX_TRAFFIC_EVENTS` — au-delà, `traffic` ne dépasse pas la
  borne (optionnel, P1).

### 2.5 `review/review.gateway.spec.ts` (P2)

Setup : `new ReviewGateway(jwt)`. Mocke un `Socket` : `{ join: jest.fn(), to: jest.fn(
() => ({ emit })), handshake: { auth: {} }, data: {} }`.

Cas :
- `onJoin` avec `{session:'s1'}` → `client.join('review:s1')`. Sans session → `join`
  pas appelé. → *room nommée correctement, pas de join vide*.
- `onMsg` avec `session` → `client.to('review:s1').emit('msg', data)` (relai vers les
  **autres**). Sans `session` → `to`/`emit` pas appelés. → *relai pur, exclut l'émetteur*.
- `handleConnection` : token valide → `client.data.user` peuplé ; token invalide →
  connexion **non interrompue**, `data.user` absent (identité best-effort). Sans token →
  retour silencieux. → *l'auth gateway est best-effort, pas un contrôle d'accès*.

### 2.6 Middleware / e2e (P2, optionnel)

`security.middleware` + `auth` de bout en bout via `supertest` est utile mais coûteux
(monte un `INestApplication`, `trust proxy`, throttler). **Ne le fais que si les P0/P1
sont finis.** Un e2e qui vaut le coup : `POST /auth/login` mauvais mdp → 401 ; bon mdp →
200 + token ; `GET /auth/me` sans token → 401, avec token → 200. Le scénario throttler
(10/min) est difficile à tester proprement → **ne le tente pas** sauf si tu maîtrises
l'isolation du `ThrottlerModule` en test (sinon flaky).

---

## 3. Frontend — cibles, invariants, cas

### 3.1 `lib/format.test.js` (P1)

Fonctions pures, faciles, mais teste les vraies branches :

- `formatTime` : `0 → "0:00"`, `5 → "0:05"`, `65 → "1:05"`, `3600 → "1:00:00"`,
  `3661 → "1:01:01"`. **Négatif** `-5 → "0:00"` (clamp `Math.max(0,…)`). `NaN`/`undefined`
  → `"0:00"` (`|| 0`). Décimal `42.7 → "0:42"` (`Math.floor`). → *format mono cohérent*.
- `colorForUser` : **déterministe** (même clé → même couleur, appel répété).
  Clés différentes peuvent différer. `null`/`undefined` → ne crash pas, renvoie une
  couleur de la palette. La sortie est **toujours** dans `USER_COLORS`. → *couleur
  stable par utilisateur*.
- `initials` : `"alice" → "AL"`, `"Jean Dupont" → "JD"`, `"  " / "" → "?"` ou la
  valeur attendue selon le code (vérifie le comportement réel : `String(name ?? '?')`),
  un seul mot court `"a" → "A"`. → *initiales max 2 lettres, jamais de crash*.
- `shortId` : longueur attendue (8), et **deux appels diffèrent** (anti-collision
  basique). Ne mocke pas `crypto` sauf pour tester le fallback `Math.random`.

### 3.2 `lib/collab.test.js` (P1)

`createTransport` choisit l'adapter selon `mode`. jsdom **n'implémente pas forcément
`BroadcastChannel`** (cf. §6) → tu devras fournir un faux global `BroadcastChannel`
contrôlable, ou tester le fallback.

Cas :
- **Sélection d'adapter** : `mode:'broadcast'` → `transport.mode === 'broadcast'`.
  `mode:'socket'` → `'socket'` (sans réellement se connecter — l'import socket.io est
  dynamique ; vérifie juste que `post`/`subscribe`/`close` existent et ne jettent pas).
- **Fallback inerte (invariant clé)** : si `BroadcastChannel` est `undefined`
  (supprime le global le temps du test), `createTransport(session)` renvoie un transport
  `mode:'none'` dont `post()`/`subscribe()`/`close()` ne jettent pas. → *vieux navigateur
  ne plante pas l'app*.
- **Contrat BroadcastChannel** : avec un faux `BroadcastChannel` qui relaie aux autres
  instances du même nom, vérifie que `post` d'une instance A est reçu par le `subscribe`
  d'une instance B (même `session`), et **pas** par A elle-même (anti-écho natif).
  Vérifie que `close()` désabonne. → *le bus respecte le contrat post/subscribe/close*.

> Le `socketTransport` réel se connecte à un serveur → **ne le teste pas en intégration
> ici** (ce serait un e2e backend). Teste seulement la forme du contrat.

### 3.3 `lib/useReview.test.jsx` (P2 — le plus délicat)

C'est un hook React avec timers, présence, anti-écho et Watch Together. **Ne teste pas
via le vrai `BroadcastChannel`** : c'est non déterministe. Stratégie propre :

- `vi.mock('./collab', …)` pour que `createTransport` renvoie un **faux transport
  contrôlable** : il garde les `subscribe` listeners dans un tableau, et tu exposes un
  `emit(msg)` de test pour simuler un message entrant d'un pair, et un `sent[]` qui
  capture tout `post(...)`.
- `vi.mock('./format', …)` pour rendre `shortId` déterministe (ids prévisibles).
- `renderHook` de `@testing-library/react`, `vi.useFakeTimers()` pour la présence.
- Mocke `localStorage` (jsdom en fournit un ; nettoie entre tests).

Cas (chacun protège une vraie mécanique) :
- **Anti-écho** : un message entrant dont `from === self.id` est **ignoré** (n'altère
  ni notes ni peers). → *on n'applique pas ses propres messages*.
- **`addNote`** : ajoute localement (trié par `time`), et **poste** un `note:add` sur le
  transport avec le payload attendu (`sent` le contient). → *mutation diffusée*.
- **Tri & upsert** : deux notes ajoutées dans le désordre temporel ressortent triées par
  `time` ; un upsert du même `id` remplace (dédupe par id), pas de doublon.
- **`removeNote`** : retire localement + poste `note:remove`.
- **Réception `note:add` d'un pair** (via `emit`) → la note apparaît dans `notes`.
- **`sync:state`** entrant → merge des notes (upsert), pas d'écrasement des locales
  absentes du payload.
- **Présence** : un pair vu puis silencieux au-delà de `PRESENCE_TIMEOUT_MS` (avance
  les fake timers) est **purgé** de `peers`. → *les fantômes disparaissent*.
- **Watch Together — anti-usurpation (invariant clé)** : un `wt:playback` provenant d'un
  `from` qui **n'est pas** le `presenterId` courant est **ignoré** (aucun callback
  `subscribePlayback` déclenché). Le même message venant du présentateur est appliqué.
  → *seul le présentateur pilote la lecture*.
- **`claimPresenter`/`releasePresenter`** : met à jour `isPresenter` et poste
  `wt:claim`/`wt:release`.
- **Départ du présentateur** : un `leave` (ou une purge) du `presenterId` courant
  remet `presenterId` à `null`. → *plus personne ne pilote si le présentateur part*.
- **Persistance** : après `addNote`, `localStorage` contient les notes sérialisées sous
  `review:notes:<session>` ; un nouveau montage `useReview` réhydrate ces notes.

> Si le montage RTL de `useReview` s'avère trop instable (timers + effets), **rabats-toi**
> sur une extraction : propose d'isoler la logique de réduction des messages (le `switch`
> du `subscribe`) dans une fonction pure testable, et signale-le dans ta PR. Ne livre pas
> un test flaky « pour cocher la case ».

---

## 4. Ce qu'on ne teste PAS (éviter le bruit)

- Les composants purement présentation (`AppShell`, `PoulpiumMark`, `Login` rendu) :
  pas de logique, le rendu pixel n'est pas un invariant. (Un smoke-render `Login` qui
  vérifie l'appel `auth.login` au submit est tolérable en P2, pas prioritaire.)
- `data/videos.js` : données statiques.
- `tokens.css` / styles.
- Les seeds de démo (`users.service` SEED) au-delà du fait qu'`onModuleInit` produit des
  hash valides (déjà couvert indirectement par `auth.service`).
- Le throttler en conditions réelles (flaky, cf. §2.6).

---

## 5. Definition of Done

- [ ] Backend : `cd backend && npm test` passe, **vert**, sans test `.skip`/`.only`.
- [ ] Frontend : outillage vitest installé, `cd frontend && npm test` passe, vert.
- [ ] `cd frontend && npm run lint` passe (LF, prettier, eslint) — **bloquant**.
- [ ] Chaque fichier de test P0/P1 listé en §2/§3 existe et couvre **au moins** les cas
      « invariant clé ».
- [ ] Aucun test ne viole la §0 (pas de `toBeTruthy` seul, pas de snapshot, pas de
      mock-de-soi-même, pas d'assertion sur durée wall-clock).
- [ ] Dans la description de PR : pour chaque fichier, **liste les invariants couverts**
      et **signale ce que tu n'as pas pu tester** et pourquoi (honnêteté > couverture).
- [ ] Rapport de couverture joint (`test:cov`) — **indicatif**, pas un objectif chiffré.

Commandes de vérif :

```bash
cd backend  && npm test
cd frontend && npm install && npm test && npm run lint
```

---

## 6. Points incertains — à VÉRIFIER par toi, Codex (ne devine pas)

Je (Claude) ne sais pas avec certitude, dans cet environnement :

1. **`argon2` (module natif) charge-t-il dans le sandbox de test ?** Lance d'abord le
   spec existant. Si le binding ne compile pas → **ne mock pas en douce** : signale-le,
   on décidera ensemble (mock de `argon2` ciblé OU exécution hors sandbox).
2. **`BroadcastChannel` est-il défini sous jsdom (version installée) ?** Si non, le test
   `collab` devra fournir un faux global. Vérifie avant d'écrire.
3. **`@testing-library/react` + React 19 + `renderHook`** : compatibilité de version.
   Si `renderHook` pose problème, dis-le plutôt que de contourner par un montage bricolé.
4. **Le `JwtService` en test** a-t-il besoin d'un secret explicite ? Regarde comment
   `auth.module.ts`/`app.module.ts` configurent `JwtModule` (secret, expiresIn) et
   reproduis la **même** config en test, sinon les tokens signés en test ne refléteront
   pas la prod.

Si l'un de ces points bloque, **arrête-toi et remonte le blocage** dans la PR avec ce
que tu as observé. Un « je ne sais pas, voici l'erreur » vaut mieux qu'un test vert qui
ment.

---

## 7. Comment je vais relire (pour que tu anticipes)

Pour chaque test je vérifierai :

1. **Mutation test mental** : je supprime/inverse la ligne de prod visée — le test
   doit rougir. Si je trouve une mutation qui passe inaperçue, le test est rejeté.
2. **L'invariant clé de chaque fichier est bien présent** (anti-énumération, épinglage
   HS256, traversée de chemin, deny-by-default, seuils `>` exacts, anti-usurpation WT).
3. **Déterminisme** : pas de dépendance au temps réel, pas d'ordre d'exécution implicite.
4. **Pas de sur-mock** qui ferait passer le test sans exercer le vrai code.
5. **Honnêteté de la PR** : ce que tu dis avoir couvert correspond au code.

Je signalerai sans détour ce qui est édulcoré. Vise juste, pas large.
