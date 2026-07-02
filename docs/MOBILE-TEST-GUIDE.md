# 📱 Guide de test — Poulpium Mobile (téléphone + émulateur)

Branche : `feat/mobile-app`. But : lancer l'app et se connecter (ex. bob / password).
L'app utilise `expo-video` (inclus dans **Expo Go**) → test possible **sans build natif**.

---

## 1. À installer (une fois, sur le PC)

| Outil | Pourquoi | Vérifier |
|---|---|---|
| **Node 20+** + npm | build JS / Expo | `node -v` |
| **Java JDK 17** | Android build | `java -version` |
| **Android Studio** | SDK + émulateur (AVD) | ouvre-le une fois |
| **Android SDK + Platform-Tools** (via Android Studio > SDK Manager) | `adb`, images système | `adb --version` |
| **Un AVD** (Android Studio > Device Manager > Create device, ex. Pixel 7, image API 34) | l'émulateur | apparait dans Device Manager |
| **Expo Go** (sur le téléphone, Play Store) | test rapide sans build | app installée |
| **Tailscale** (PC + téléphone) — seulement si Core sur le NAS | joindre `100.109.250.78` | `tailscale status` |

Variables d'env utiles (`~/.bashrc`) si `adb` introuvable :
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

---

## 2. Lancer le serveur (Core) — obligatoire

Deux options :

- **Local (recommandé pour tester ici)** :
  ```bash
  cd backend && npm install && npm run start:dev   # écoute sur :3000
  ```
- **NAS Tailscale** : Core déjà lancé sur `100.109.250.78:3000` ; le client (PC/téléphone) **doit être sur Tailscale**.

Vérifier que le Core répond :
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"bob","password":"password"}' -w '\nHTTP %{http_code}\n'
# Attendu : HTTP 201 + {"accessToken":"...","user":{...}}
```
> HTTP 000 / timeout = Core éteint ou réseau (Tailscale). Le problème est **serveur**, pas app.

---

## 3. Configurer l'URL selon la cible

Créer `mobile/.env` (ou utiliser `scripts/dev-mobile.sh` qui le génère avec l'IP LAN) :

| Cible de test | `EXPO_PUBLIC_API_URL` |
|---|---|
| **Téléphone (Expo Go)** sur le même Wi-Fi que le PC | `http://<IP_LAN_DU_PC>:3000` (jamais `localhost`) |
| **Téléphone via NAS** | `http://100.109.250.78:3000` (téléphone sur Tailscale) |
| **Émulateur Android** (Core local sur le PC) | `http://10.0.2.2:3000` (10.0.2.2 = « localhost du PC » vu de l'AVD) |

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
EXPO_PUBLIC_COLLAB_MODE=socket
```
Trouver l'IP LAN du PC : `hostname -I | awk '{print $1}'`.

---

## 4A. Tester sur téléphone (le plus rapide)
```bash
cd mobile && npm install
npx expo start            # affiche un QR code
```
- Scanner le QR avec **Expo Go** (téléphone + PC sur le même réseau).
- Se connecter : **bob / password**.

## 4B. Tester sur émulateur
```bash
# 1) démarrer un émulateur (ou via Android Studio > Device Manager > ▶)
emulator -list-avds
emulator -avd <NOM_AVD> &

# 2) lancer l'app dessus
cd mobile && npm install
npx expo start            # puis appuyer sur "a"  (ouvre sur l'émulateur)
```
- Avec `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` et le Core local lancé.
- Se connecter : **bob / password**.

> Si un module natif manque en Expo Go, faire un dev build : `npm run android` (nécessite JDK + SDK ; 1er build long).

---

## 5. Vérifier / diagnostiquer

| Symptôme | Vérif | Cause probable |
|---|---|---|
| Reste sur spinner / très long | `curl` login (section 2) depuis le PC/tel | Core injoignable (réseau/Tailscale/éteint) |
| « Serveur injoignable » | `adb reverse` non nécessaire si `10.0.2.2` ; sinon `adb reverse tcp:3000 tcp:3000` | mauvais URL / cleartext |
| Login KO mais Core OK | tester `alice/bob/carol` · `password` | mauvais identifiants |
| Vidéo ne lit pas | Core + clé AES (`/keys/:id`) sur token | header JWT sur la requête de clé (device réel) |
| Temps réel muet | Core lancé, même `session` | socket bloqué (Wi-Fi restreint) |

Logs utiles :
- Metro/Expo : le terminal de `npx expo start` (erreurs JS, requêtes).
- Émulateur : `adb logcat | grep -iE "poulpium|ReactNative|fetch"`.

---

## 6. Rappels
- Comptes : **alice** (admin), **bob**, **carol** — mot de passe **password** (comptes Core, pas le NAS).
- Le Core **doit tourner** ET être **joignable** depuis la cible (LAN Wi-Fi, ou Tailscale pour le NAS).
- `mobile/.env` n'est pas versionné : à recréer sur chaque poste (ou via `scripts/dev-mobile.sh`).
