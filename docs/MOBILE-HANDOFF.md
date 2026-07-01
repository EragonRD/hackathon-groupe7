# 📱 Poulpium Mobile — reprise & lancement (handoff)

> Document de reprise pour continuer le travail sur un **autre poste** (portable).
> Branche : `feat/mobile-app` · Dernier commit : `c4d35da`.
> Lis d'abord ce fichier, puis les docs indexées en fin de page.

## 1. Où on en est

- Portage **React Native (Expo, SDK 57)** de la View Poulpium, dossier `mobile/`.
- Squelette produit par un agent, **audité puis corrigé** (cf. `docs/AUDIT-MOBILE-GEMINI.md`).
- Template Expo par défaut **supprimé**, projet en **pur JS**, une seule racine de routes `app/`.
- Fonctionnel (code en place) : Login, Catalogue, Revue (lecteur HLS chiffré, dessin
  7 outils en coords 0..1, timeline à marqueurs, commentaires), temps réel (présence,
  curseurs, Watch Together), export/import JSON, change-password, admin/dashboard/docs.
- Qualité : `expo lint` **0/0**, `expo-doctor` **20/20**.

## 2. Audit de démarrage (run-readiness)

### Vert
| Contrôle | Résultat |
|---|---|
| `expo-doctor` | 20/20 |
| `expo lint` | 0 erreur / 0 warning |
| Assets `app.json` | tous présents (icônes, splash, favicon, police JetBrains Mono) |
| Imports morts | aucun |
| Secrets | aucun `.env` versionné ; `.env*.local` et `node_modules/` ignorés |

### 🔴 Critique : NE PAS utiliser Expo Go
`react-native-video` **n'est pas inclus dans Expo Go** : l'écran de revue plantera
(module natif absent). Il faut un **development build** :
```bash
cd mobile && npm install
npm run android        # = expo run:android (build natif)   ·   ou : npm run ios
```
Prérequis sur le portable : **Android Studio + SDK** (ou Xcode pour iOS), ou un build
**EAS**. Le 1er build télécharge Gradle/pods (long, réseau requis).

### 🟠 Pour que ça marche de bout en bout
1. **Core lancé** (`backend/`, `npm run start:dev`) et joignable, sinon login KO.
2. **`mobile/.env`** avec l'**IP LAN** de la machine (jamais `localhost` : le téléphone/emu
   ne route pas `localhost` vers ton PC) :
   ```
   EXPO_PUBLIC_API_URL=http://<TON_IP_LAN>:3000
   EXPO_PUBLIC_COLLAB_MODE=socket
   ```
3. **Risque résiduel** (test n°1) : vérifier sur device réel que le header
   `Authorization` part bien sur la requête de **clé AES** HLS (`mobile/src/components/SecureVideo.js`).
   Si la clé est refusée, basculer sur un **proxy de clé local** (piste notée dans le fichier).

### ℹ️ Mineur (non bloquant)
Deps inutilisées héritées du template (`@expo/ui`, `expo-glass-effect`, `expo-symbols`,
`expo-image`, `expo-web-browser`…) : du poids, pas un blocage.

## 3. Checklist de test rapide
- [ ] `git pull` sur `feat/mobile-app`.
- [ ] `backend/` lancé et accessible depuis le LAN.
- [ ] `mobile/.env` avec l'IP LAN.
- [ ] `cd mobile && npm install`.
- [ ] `npm run android` (dev build, PAS Expo Go).
- [ ] Login (alice/bob/carol · password) → Catalogue → Revue.
- [ ] Valider la lecture de la vidéo chiffrée (clé AES + token). C'est LE point à confirmer.
- [ ] 2e device sur la même session → présence/notes en direct (mode socket).

## 4. Prochaines étapes possibles
- Confirmer/durcir le déchiffrement HLS (proxy de clé si besoin).
- Réponses aux commentaires, likes, résolu (déjà dans `useReview`, à exposer dans l'UI).
- Retirer les deps template inutilisées.
- Écran admin : CRUD réel (aujourd'hui lecture seule).

## 5. Index des docs mobile
- `docs/MOBILE-HANDOFF.md` — ce fichier (reprise + run).
- `docs/AUDIT-MOBILE-GEMINI.md` — audit du 1er jet + corrections.
- `docs/GEMINI-BRIEF-MOBILE.md` — brief visuel exhaustif (tokens, wireframes, contrats).
- `docs/PLAN-MOBILE-RN.md` — plan de portage (règles frontend, réutilisation, risques).
- `mobile/README.md` — configuration + lancement côté app.

## 6. Reprendre la main avec Claude Code depuis le portable

Le contexte de session **ne se synchronise pas** automatiquement entre machines.
La continuité passe par **git** (ce dépôt + ces docs). Sur le portable :

1. Installer Claude Code puis s'authentifier :
   ```bash
   npm install -g @anthropic-ai/claude-code    # ou l'installeur officiel
   claude            # suivre l'auth au 1er lancement
   ```
2. Récupérer le dépôt et se placer dessus :
   ```bash
   git clone <url-du-repo> && cd hackathon-groupe7
   git checkout feat/mobile-app && git pull
   ```
3. Lancer Claude Code **dans le dossier du repo** et lui donner le point d'entrée :
   ```bash
   claude
   ```
   Puis, comme première instruction :
   > « Lis `docs/MOBILE-HANDOFF.md` et `docs/AUDIT-MOBILE-GEMINI.md`, on reprend le
   >   portage mobile sur la branche `feat/mobile-app`. »

   Claude relira aussi `CLAUDE.md` (protocole projet) automatiquement.

### Continuer une conversation Claude Code
- `claude --continue` (ou `claude -c`) : reprend la **dernière** conversation **de ce
  dossier sur cette machine**.
- `claude --resume` (ou `claude -r`) : choisir une conversation passée à reprendre.
- ⚠️ Ces historiques sont **locaux** (`~/.claude/projects/...`) : ils ne suivent pas
  d'un PC à l'autre. Sur un nouveau poste, la reprise fiable = **ce dépôt + ces docs**
  (une nouvelle session Claude Code repart avec tout le contexte écrit ici).
- Alternative multi-appareils : l'app web **claude.ai/code** (même compte) pour retrouver
  une session côté cloud.
