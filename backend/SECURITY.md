# P2 - Securite backend

## Zero-Trust HLS

Generer la cle AES et les segments HLS chiffres :

```bash
./scripts/encrypt-hls.sh
```

Demarrer le Core et Nginx en une commande. Le conteneur tourne en
`NODE_ENV=production` et **refuse de demarrer avec un secret faible** : il faut
fournir un `JWT_SECRET` fort.

```bash
export JWT_SECRET=$(openssl rand -hex 32)
docker compose up --build
```

> Le dashboard `/security/dashboard` est reserve a un compte **admin** (ex. `alice`).
> Le dashboard HTML `security.html` integre un login pour recuperer le token.

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

## Anti-scraping temps reel

Le Core applique un rate-limit global de `100 req / 60s / IP` (et `10/min/IP` +
verrouillage de compte sur `/auth/login`), journalise les alertes dans
`backend/logs/security-alerts.log` et expose :

```bash
# dashboard JSON : réservé admin -> token requis
ADMIN="$(curl -sS -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password"}' \
  | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>console.log(JSON.parse(s).accessToken))")"
curl -H "Authorization: Bearer $ADMIN" http://localhost:3000/security/dashboard
open http://localhost:3000/security.html
```

Endpoint watermark protege :

```bash
TOKEN="$(curl -sS -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password"}' \
  | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>console.log(JSON.parse(s).accessToken))")"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/security/watermark
```

Scripts d'attaque :

```bash
./scripts/attacks/multi-session.sh
./scripts/attacks/proxy-ip.sh
./scripts/attacks/scrape-segments.sh
./scripts/attacks/flood.sh
```

IP proxy de demo :

```bash
./scripts/attacks/proxy-ip.sh
```
