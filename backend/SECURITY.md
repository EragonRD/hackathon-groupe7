# P2 - Securite backend

## Zero-Trust HLS

Generer la cle AES et les segments HLS chiffres :

```bash
./scripts/encrypt-hls.sh
```

Demarrer le Core et Nginx en une commande :

```bash
cp .env.example .env
docker compose up --build
```

Verifier la playlist HLS :

```bash
curl http://localhost:8080/hls/poc/index.m3u8
```

Verifier que Nginx ne sert pas la cle :

```bash
curl -i http://localhost:8080/keys/poc
```

Preuve d'acces a la cle via le Core :

```bash
./scripts/prove-zero-trust.sh
```

Resultats attendus :

- token valide : `200` et exactement `16` octets
- sans token : `401`
- token bidon : `401`
- token expire : `401`

Les acces cle sont journalises dans `backend/logs/key-access.log`.

## Auth lecteur HLS

Le lecteur frontend doit envoyer le JWT uniquement sur la requete de cle :

```js
hls.config.xhrSetup = (xhr, url) => {
  if (url.includes('/keys/')) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
  }
}
```

## Documents

- Modele de menace : `docs/P2-threat-model.md`
- Anti-scraping : `docs/P2-anti-scraping.md`
