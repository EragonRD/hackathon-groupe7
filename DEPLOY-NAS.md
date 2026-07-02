# Déploiement Poulpium sur NAS UGREEN

Marche à suivre complète pour héberger Poulpium (Core + Frontend) sur un NAS
UGREEN, exposé via **Cloudflare Tunnel**, avec **mise à jour automatique**
(Watchtower) à chaque `push` sur `master`.

- Fichier de déploiement : **`docker-compose.nas.yml`**
- Chaîne : CI GitHub -> images `ghcr.io` -> NAS tire les images -> tunnel Cloudflare.

---

## 0. Vue d'ensemble

```
                        Internet
                           |
              https://poulpium.midjix-lab.com
                           |
                  [ Cloudflare Tunnel ]        (conteneur `tunnel`)
                           |  http://frontend:80
                           v
   [ frontend nginx ] --proxy--> [ core NestJS :3000 ]
     :5173 (LAN)                    :4004 (LAN)
        SPA React                   auth, HLS, socket.io, admin
                                        |
                                   volumes NAS (data/media/secrets/logs)
```

- **Frontend** sert la SPA et proxifie `/auth /keys /admin /security /contents
  /videos /notes /socket.io` vers `core` (réseau Docker interne).
- **Core** sert lui-même le HLS chiffré (pas de service `hls` séparé requis).
- **Watchtower** surveille les conteneurs taggés et tire la nouvelle `:latest`.
- **Engine (Pôle 3 / IA)** est **optionnel** et commenté (aucune image publiée).

---

## 1. Prérequis

| Élément | Détail |
|---|---|
| NAS UGREEN | UGOS avec **Docker** activé (Centre d'applications -> Docker). |
| Accès SSH ou UI Docker | Pour lancer un `docker compose` (ou coller le compose dans l'UI). |
| Domaine Cloudflare | `midjix-lab.com` géré dans Cloudflare (DNS actif). |
| Compte GitHub | Le dépôt qui publie les images sur `ghcr.io/eragonrd/*`. |

---

## 2. Rendre les images GHCR accessibles

Les images sont poussées par la CI (`.github/workflows/docker.yml`) à chaque
`push`/merge sur `master` :

- `ghcr.io/eragonrd/hackathon-backend:latest`
- `ghcr.io/eragonrd/hackathon-frontend:latest`

Deux cas pour que le NAS puisse les tirer :

**A. Images publiques (le plus simple)**
GitHub -> repo -> **Packages** -> chaque package -> *Package settings* ->
**Change visibility** -> **Public**. Rien d'autre à faire sur le NAS.

**B. Images privées**
Créer un **PAT** (scope `read:packages`), puis sur le NAS :

```bash
echo "<PAT>" | docker login ghcr.io -u <votre-user-github> --password-stdin
```

Watchtower réutilisera ce login pour les mises à jour.

---

## 3. Créer les dossiers de données sur le NAS

Les volumes sont des **bind mounts** (données visibles dans le gestionnaire de
fichiers UGREEN, sauvegardables). Créez-les AVANT le premier démarrage :

```bash
mkdir -p /volume1/docker/Hackathon/{data,media,secrets,logs}
```

> **Chemin `/volume1`** : convention Synology, souvent valable sur UGOS. Si votre
> NAS expose un autre point de montage, adaptez les 4 lignes `volumes:` du
> compose en conséquence.

| Dossier | Contenu | Sauvegarde |
|---|---|---|
| `data/` | JSON métier : `users`, `companies`, `contents`, `analysis`, `bans` | **Oui** |
| `media/` | Vidéos HLS chiffrées (uploads) | **Oui** (volumineux) |
| `secrets/` | Clés AES des vidéos (`*.key`) | **Oui, critique** |
| `logs/` | Audit : `key-access.log`, `security-alerts.log` | Optionnel |

> Un bind mount vide n'est **pas** amorcé par l'image. Le seed `proxy-ips.txt`
> n'est donc pas copié automatiquement : bénin (liste vide). Au premier
> démarrage sans `users.json`, les comptes démo `alice` / `bob` / `carol`
> (mot de passe `password`) sont disponibles.

---

## 4. Configurer le Tunnel Cloudflare

1. Cloudflare **Zero Trust** -> **Networks** -> **Tunnels** -> *Create a tunnel*
   (type **Cloudflared**). Nommez-le (ex. `poulpium-nas`).
2. **Copiez le token** affiché (`eyJ...`) : il ira dans le compose (service
   `tunnel`, à la place de `***`).
3. Onglet **Public Hostname** du tunnel, ajoutez une route :
   - **Subdomain** : `poulpium`
   - **Domain** : `midjix-lab.com`
   - **Service** : `HTTP` -> `frontend:80`
     *(le conteneur `tunnel` joint `frontend` par son nom sur le réseau
     `poulpium` défini dans le compose)*
4. Cloudflare crée automatiquement l'enregistrement DNS
   `poulpium.midjix-lab.com`.

> `APP_URL` du Core est déjà réglé sur `https://poulpium.midjix-lab.com/`
> (utilisé dans les emails d'invitation Mailjet).

---

## 5. Renseigner les secrets du compose

Éditez `docker-compose.nas.yml` et remplacez chaque `***` :

| Champ | Où | Valeur |
|---|---|---|
| `MAILJET_API_KEY` | service `core` | clé API Mailjet |
| `MAILJET_SECRET_KEY` | service `core` | secret Mailjet |
| `tunnel` -> `--token ***` | service `tunnel` | token de l'étape 4.2 |

> **Mailjet vide** = mode simulation (les invitations sont seulement *loguées*,
> pas envoyées). L'app reste fonctionnelle.

> **JWT_SECRET** : une valeur est déjà en place. Pour une vraie prod,
> régénérez-la (`openssl rand -hex 32`) et **redémarrez** (invalide les tokens
> existants). Si vous activez l'Engine, il doit porter **le même** secret.

### Réglage vidéo (optionnel)

Le chiffrement HLS ré-encode en H.264 (ffmpeg, très CPU). `MAX_CONCURRENT_ENCODES`
(service `core`) borne le nombre d'encodages **simultanés** (file FIFO) :

| Valeur | Quand |
|---|---|
| `1` (défaut code) | NAS peu puissant / mono-cœur : uploads traités un par un. |
| `2` (valeur du compose) | NAS multi-cœurs : deux uploads chiffrés en parallèle. |
| `3+` | Seulement si CPU confortable (risque de saturation / OOM sinon). |

> Le binaire ffmpeg est **celui du système** (image Alpine, `apk add ffmpeg`) :
> aucune installation à faire côté NAS.

---

## 6. Démarrer

Copiez `docker-compose.nas.yml` sur le NAS (ex. dans
`/volume1/docker/Hackathon/`), puis :

```bash
cd /volume1/docker/Hackathon
docker compose -f docker-compose.nas.yml pull
docker compose -f docker-compose.nas.yml up -d
```

Ou via l'UI Docker UGREEN : *Projet* -> *Créer* -> coller le compose -> *Démarrer*.

Vérifier :

```bash
docker compose -f docker-compose.nas.yml ps      # tous "running", core "healthy"
docker compose -f docker-compose.nas.yml logs -f core
```

---

## 7. Vérifier le déploiement

| Test | Attendu |
|---|---|
| `http://<ip-nas>:5173` (LAN) | Écran de connexion Poulpium |
| `https://poulpium.midjix-lab.com` | Idem, via le tunnel |
| Connexion `alice` / `password` | Accès au catalogue (admin) |
| `docker inspect poulpium-core --format '{{.State.Health.Status}}'` | `healthy` |
| Upload d'une vidéo | Fichiers chiffrés apparaissent dans `media/` et `secrets/` |

---

## 8. Mises à jour (automatique)

À chaque `push`/merge sur `master`, la CI reconstruit les images `:latest`.
**Watchtower** (intervalle 5 min) détecte la nouvelle image des conteneurs
taggés `com.centurylinklabs.watchtower.enable=true` (core + frontend), tire,
recrée le conteneur et nettoie l'ancienne image. **Aucune action manuelle.**

Forcer une mise à jour immédiate :

```bash
docker compose -f docker-compose.nas.yml pull
docker compose -f docker-compose.nas.yml up -d
```

---

## 9. Sauvegarde / restauration

Tout l'état vit dans `/volume1/docker/Hackathon/`. Sauvegarde :

```bash
tar czf poulpium-backup-$(date +%F).tar.gz -C /volume1/docker/Hackathon \
  data media secrets
```

Restauration : réextraire dans le même chemin, puis `up -d`.
> `secrets/` est **indispensable** : sans les clés AES, les vidéos chiffrées de
> `media/` sont irrécupérables.

---

## 10. (Optionnel) Activer l'Engine IA — Pôle 3

Aucune image `hackathon-engine` n'est publiée (la CI ne build que backend +
frontend). Pour l'activer :

1. Publier une image `ghcr.io/eragonrd/hackathon-engine:latest` (ajouter une
   étape build dans `docker.yml`, contexte `./engine`) **ou** construire sur le
   NAS avec le source (`build: ./engine`).
2. Dans `docker-compose.nas.yml` : **décommenter** le service `engine` ET la
   ligne `ENGINE_URL: "http://engine:8000"` sous `core`.
3. Créer les dossiers de cache : `mkdir -p /volume1/docker/Hackathon/{hf_cache,engine_out}`.

> L'Engine télécharge des modèles (~1-2 Go) et est **CPU-only** : premier
> démarrage lent. Sans lui, l'analyse IA renvoie proprement « service hors
> ligne » et le reste de l'app fonctionne.

---

## 11. Dépannage

| Symptôme | Cause probable / action |
|---|---|
| `core` reste `unhealthy` | Voir `logs core`. Souvent `JWT_SECRET` manquant/faible (le Core refuse de démarrer en prod avec un secret faible). |
| Tunnel actif mais 502 | Route publique mal configurée : cible doit être `frontend:80`, et `tunnel` sur le réseau `poulpium`. |
| Temps réel KO entre machines | Vérifier le proxy `/socket.io` (déjà dans le nginx du frontend) et que le tunnel pointe sur le frontend, pas le core. |
| `pull access denied` (GHCR) | Images privées : refaire `docker login ghcr.io` (étape 2B) ou passer les packages en public. |
| Emails d'invitation non reçus | `MAILJET_*` vides ou `MAILJET_SANDBOX: "true"` -> mode simulation. |
| Disque qui se remplit | Vérifier que le `logging` borné (10m×3) est bien présent sur chaque service. |
```
