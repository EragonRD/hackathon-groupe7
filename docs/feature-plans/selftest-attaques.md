# Feature — Auto-test des scénarios d'attaque depuis le dashboard (Pôle 2-B)

## Contexte

Les 4 scripts `scripts/attacks/*.sh` (flood, multi-session, proxy-ip,
scrape-segments) valident la détection anti-abus. Problème : ils forgent
`X-Forwarded-For`, honoré **uniquement** si la requête vient d'un proxy de
confiance (`TRUST_PROXY` = loopback + réseaux privés, `backend/src/main.ts`).
Depuis un navigateur ou une machine externe, le reverse-proxy réécrit l'en-tête
→ le spoofing meurt → impossible de démontrer la détection « en prod » sans
ouvrir un terminal sur le serveur.

## Objectif

Un bouton dans le dashboard de surveillance (admin) qui **lance les 4 scénarios
et affiche PASS/FAIL**, fonctionnant à l'identique en local ET en prod, sans
accès shell au serveur.

## Constats (code existant)

- Détection : `SecurityService` (fenêtre glissante 5 min ; alertes TTL 10 min).
- Seuils réels (⚠️ divergent des scripts bash) :
  - `multi_session` : > 3 IP distinctes / compte / 5 min.
  - `proxy_ip` : IP ∈ `backend/data/proxy-ips.txt` (contient `203.0.113.0/24`).
  - `segment_scrape` : > 60 req `.ts` / 60 s (alerte) ; > 120 (block nginx).
  - flood : `@nestjs/throttler` 100 req / 60 s / IP → `429`.
- `POST /security/ingest` réservé à `isTrustedPeer` (loopback / privé).
- `JwtModule` global → `JwtService` injectable partout.
- Dashboard admin : `GET /security/dashboard` (`AuthGuard` + `AdminGuard`).

## Décisions

- **Runner côté serveur** : le Core rejoue les scénarios en **self-HTTP** sur
  `http://127.0.0.1:${PORT}`. Source = loopback → `TRUST_PROXY` honore le XFF
  forgé → **prouve toute la chaîne de prod** (trust-proxy + middleware +
  throttler + nginx-ingest), pas seulement la logique métier.
- **Port TypeScript** des scripts bash (pas de `bash`/`curl`/fichiers embarqués
  dans l'image Docker, où ils sont absents).
- **IP de test** en plages réservées (`192.0.2.x`, `203.0.113.x` = RFC 5737) →
  aucun vrai visiteur banni/flaggé.
- **Token de test** signé via `JwtService` (compte synthétique `selftest`, sans
  `sid` → pas de contrôle mono-session) : pas de consommation du rate-limit
  `/auth/login`.
- **Assertions** : lues en direct via `SecurityService.getDashboard()`
  (in-process) ; le flood est asserté sur l'observation d'un `429`.

## Risques

| Risque | Mitigation |
|---|---|
| Alertes persistantes polluent le dashboard | Voulu (démo) ; TTL 10 min ; IP de test isolées |
| Double-clic < 30 s → dédup alerte | Assertion = « alerte présente », pas « nouvelle » → reste vert |
| `segment_scrape` block nginx (403) non exercé | On teste l'**alerte** (> 60) ; le block dur exige un vrai flux HLS → noté |
| Node < 18 (pas de `fetch` global) | Backend NestJS récent (Node 18+) ; sinon `undici` |

## Plan d'action

- [✅] `docs/feature-plans/selftest-attaques.md` (ce fichier)
- [✅] `backend/src/security/selftest.service.ts` — `SecuritySelftestService.run()`
- [✅] `security.module.ts` — enregistrer le provider
- [✅] `security.controller.ts` — `POST /security/selftest` (admin)
- [✅] `SecurityDashboard.jsx` — bouton + rendu des résultats
- [✅] `App.css` — styles du panneau résultats
- [✅] Vérif manuelle (backend up + endpoint réel)

## Avancement

Livré et vérifié end-to-end. `POST /security/selftest` (admin) : 4/4 scénarios
`pass`. Garde vérifié : bob `403`, anonyme `401`. `nest build` OK, `lint` front OK.

Résultats réels observés :
| Scénario | Verdict | Détail |
|---|---|---|
| flood | pass | HTTP 429 à la requête 101 (limite 100/60s) |
| multi_session | pass | 4 IP distinctes / 300s |
| proxy_ip | pass | IP ∈ 203.0.113.0/24 |
| segment_scrape | pass | 61 req .ts / 60s |

## Résumé non-technique

On ajoute un bouton « Lancer les tests d'attaque » dans le tableau de bord de
sécurité, réservé aux administrateurs. En un clic, le serveur se lance à
lui-même les 4 attaques types (flood, comptes multiples, proxy suspect,
aspiration de vidéo) et affiche pour chacune un voyant vert (détectée) ou rouge
(non détectée). Avantage clé : ça marche aussi en production, sans avoir à se
connecter en ligne de commande sur le serveur.
