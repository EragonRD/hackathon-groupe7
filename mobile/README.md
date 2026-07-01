# Poulpium Mobile (React Native)

Ceci est le portage mobile React Native (Expo) de l'outil B2B pro de revue vidéo collaborative "Poulpium".

## Configuration

Créez un fichier `.env` à la racine de `mobile/` ou exportez ces variables avant de lancer l'application :

```bash
EXPO_PUBLIC_API_URL=http://<VOTRE_IP_LOCALE>:3000
EXPO_PUBLIC_COLLAB_MODE=socket
```

Il est important de mettre votre IP locale au lieu de `localhost` car l'application mobile (simulateur Android / iOS, ou téléphone physique via Expo Go) a besoin de contacter le serveur sur le réseau local.

## Lancer l'application

```bash
npm install
npm run android # ou npm run ios
```

## Choix techniques
- **UI** : Design sombre, JetBrains Mono pour les timecodes, couleurs strictement portées depuis `tokens.css`.
- **HLS** : `react-native-video` avec interception de la requête de clé pour ajouter le JWT (`Authorization: Bearer`).
- **Temps réel** : `socket.io-client` uniquement (pas de `BroadcastChannel`), même bus que le frontend web.
- **Dessin** : `@shopify/react-native-skia` (coords normalisées 0..1 pour compatibilité web).
