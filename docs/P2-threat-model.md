# P2-A - Modele de menace Zero-Trust

## Objectif

Proteger la cle AES qui permet de dechiffrer les segments HLS. Les fichiers `.m3u8`
et `.ts` peuvent etre servis par Nginx, mais la cle `backend/secrets/poc.key`
n'est delivree que par le Core NestJS apres validation du JWT existant.

## Schema

```text
Utilisateur authentifie
        |
        | 1. POST /auth/login -> JWT court
        v
Core NestJS :3000 -------------------------+
        |                                  |
        | 2. GET /keys/poc + Bearer JWT    | journal key-access.log
        v                                  |
backend/secrets/poc.key                    |
                                           |
Lecteur HLS                                |
        | 3. playlist + segments chiffres  |
        v                                  |
Nginx :8080 /hls/poc/index.m3u8 -----------+
```

## Ce qui est protege

- La cle AES-128 du contenu `poc`.
- La liaison entre la cle et une identite JWT courte.
- La preuve d'acces avec `backend/logs/key-access.log`.

## Menaces couvertes

- Lecture de la cle sans JWT : refus `401` par `AuthGuard`.
- JWT invalide ou expire : refus `401` par `AuthGuard`.
- Utilisateur sans droit sur un contenu : refus `403` par `KeysService`.
- Exposition accidentelle de la cle via Nginx : le service HLS ne monte que `media/hls/`.
- Traversee de chemin sur `contentId` : identifiant valide par regex stricte et
  controle d'acces effectue AVANT toute lecture de fichier (`KeysService`).
- Bruteforce / credential stuffing sur `/auth/login` : rate-limit `10/min/IP`
  (`@Throttle`) + verrouillage du compte apres 5 echecs (`429`, voir `AuthService`).

## Hypotheses

- `JWT_SECRET` est fort et conserve hors du depot.
- `backend/secrets/` n'est jamais servi en statique et reste gitignore.
- Le lecteur HLS ajoute le header `Authorization: Bearer <token>` sur la requete de cle.
- Le contenu source est chiffre par `scripts/encrypt-hls.sh` avant la demo.

## Limites assumees

- Un utilisateur autorise peut capturer la cle pendant la duree de validite de son JWT.
- Le chiffrement HLS protege la distribution, pas l'ecran de l'utilisateur final.
- Il n'y a pas encore de rotation automatique de cle par session.
- En HTTP local, le token circule sans TLS ; en production il faut HTTPS obligatoire.
- L'IP client provient de `X-Forwarded-For`, honore uniquement derriere un proxy
  de confiance (`TRUST_PROXY`, voir `main.ts`). Un client direct non fiable ne peut
  pas usurper son IP ; en prod, `TRUST_PROXY` doit lister UNIQUEMENT le sous-reseau
  du reverse-proxy, et nginx doit reecrire l'en-tete entrant.

## Menaces connues NON traitees (assumees)

- **Pas de revocation de JWT** : un token vole reste valide jusqu'a expiration
  (stateless). Mitige par le TTL court ; un vrai produit ajouterait une blacklist
  ou des refresh tokens.
- **Cle unique par contenu** (pas par session) : si la cle fuite, tout le contenu
  est compromis. Piste : cle par session + rotation.
- **Verrouillage de compte = DoS cible possible** : un attaquant peut volontairement
  verrouiller un compte connu en enchainant des echecs. Compromis assume ; un produit
  reel combinerait verrouillage par IP + captcha + backoff progressif.
- **Scraping distribue** (botnet, low-and-slow, multi-comptes) : echappe aux seuils
  par IP / par compte. Necessiterait une correlation comportementale plus avancee.
- **DoS volumetrique / epuisement memoire** : le store de detection est en memoire
  et borne ; pas de protection dediee contre un flood distribue.
- **Capture d'ecran / HDMI** : indetectable de maniere fiable cote serveur ; seul le
  watermark de session dissuade et trace.
