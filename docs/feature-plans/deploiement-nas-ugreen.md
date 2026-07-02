# Feature — Déploiement NAS UGREEN (Poulpium en prod locale)

## Contexte
Poulpium (Core NestJS + Frontend React) doit tourner en continu sur un NAS
UGREEN, exposé publiquement via Cloudflare Tunnel (`poulpium.midjix-lab.com`),
avec mise à jour automatique des images. Les images sont construites par la CI
GitHub (`.github/workflows/docker.yml`) et publiées sur GHCR ; le NAS les tire.

## Objectif
Fournir un fichier de déploiement **complet, valide et sûr** pour le NAS, plus
la documentation opératoire, sans casser le flux vidéo (upload → HLS chiffré →
lecture) ni exposer de secret au dépôt git.

## Constats
- Le compose initial (fourni par l'utilisateur) omettait des réglages présents
  dans le compose de dev : `HLS_DIR`, bornage des logs, réseau nommé, healthcheck.
- La CI ne publie **que** `backend` + `frontend` (pas d'image `engine`) → Pôle 3
  IA optionnel sur le NAS (dégradation propre côté Core si Engine injoignable).
- Volumes en **bind mount** `/volume1/docker/Hackathon/*` : non amorcés par
  l'image (contrairement aux volumes nommés) → seed `proxy-ips.txt` non copié
  (bénin), dossiers à créer avant le 1er `up`.
- Flux vidéo : après rebase (8 commits), résolution ffmpeg fiabilisée
  (priorité binaire système Alpine, sonde `-version` status 0, cache). Dockerfile
  installe `ffmpeg` → aucune action NAS.
- Secret : `docker-compose.nas.yml` contient des secrets → **gitignoré**
  (`.gitignore`), vit uniquement sur le disque du NAS.

## Décisions
- **Un seul fichier de déploiement** : `docker-compose.nas.yml` (local NAS,
  gitignoré). Le compose de dev `docker-compose.yml` reste pour le build local.
- **CI inchangée** : elle marchait déjà (build + push backend/frontend). Aucune
  modification (les enhancements cache/SHA testés ont été annulés à la demande).
- **Engine commenté** dans le compose (aucune image publiée) ; `ENGINE_URL`
  commenté en conséquence.
- **Robustesse NAS** : logs bornés (`json-file`), réseau `poulpium`, healthcheck
  Core (`/socket.io`), `frontend depends_on core: service_healthy`, `TZ`,
  `MAX_CONCURRENT_ENCODES: "2"` (parallélisme ffmpeg maîtrisé).
- **Tunnel** : route publique Cloudflare → `frontend:80` (config dashboard, hors
  compose). Le frontend proxifie API + `/socket.io` vers `core`.

## Risques
- Secrets `***` non renseignés → emails en simulation, pas d'accès public.
- `JWT_SECRET` exposé en clair (chat/fichier) → à régénérer avant vraie prod.
- Images GHCR privées → le NAS doit `docker login ghcr.io` (sinon `pull denied`).
- Comptes démo `alice/bob/carol` (mdp `password`) actifs → à changer en prod.
- Bind mount `secrets/` = clés AES : sa perte rend les vidéos irrécupérables.

## Plan d'Action
- [✅] Créer `docker-compose.nas.yml` (images GHCR + tunnel + watchtower).
- [✅] Aligner `HLS_DIR`, montages `media`/`secrets`/`data`/`logs` sur le code.
- [✅] Ajouter logs bornés, réseau nommé, healthcheck, `depends_on` sain, `TZ`.
- [✅] Ajouter `MAX_CONCURRENT_ENCODES: "2"`.
- [✅] Gitignorer le compose (aucun secret au dépôt).
- [✅] Rédiger `DEPLOY-NAS.md` (procédure complète + dépannage).
- [✅] Vérifier le flux vidéo après rebase (ffmpeg système, routes `/videos`+`/keys`).
- [✅] Valider la syntaxe compose (`docker compose config`).
- [❌] Renseigner les 3 secrets `***` (Mailjet ×2 + token tunnel) — côté NAS.
- [❌] Régénérer `JWT_SECRET` — côté NAS.
- [❌] Créer les 4 dossiers `/volume1/docker/Hackathon/*` — côté NAS.
- [❌] Configurer la route publique Cloudflare `frontend:80` — dashboard.

## Avancement
Fichier de déploiement **complet, valide et vérifié** côté code. Restent
uniquement des actions **opérationnelles** sur le NAS (secrets, dossiers,
tunnel) avant `docker compose -f docker-compose.nas.yml up -d`.

## Résumé Non-Technique
On a préparé le « mode d'emploi » et le fichier unique qui font tourner Poulpium
sur le petit serveur maison (NAS), accessible depuis Internet via une adresse
sécurisée. Le fichier a été rendu robuste (les journaux ne peuvent plus saturer
le disque, le site attend que le serveur soit prêt avant de démarrer, la vidéo
reste lisible). Les mots de passe et clés secrètes ne sont **jamais** envoyés
sur GitHub : ils restent sur le NAS. Il ne reste qu'à saisir ces secrets et
créer les dossiers de stockage sur le NAS pour lancer le tout.
