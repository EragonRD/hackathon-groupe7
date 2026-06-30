# P2-B - Detection et anti-scraping

## Objectif

Detecter les abus en temps reel sans dupliquer l'identite : le meme JWT emis par
`/auth/login` sert au rattachement compte pour les alertes.

## Socle

- Rate limit global NestJS : `100 req / 60s / IP` via `@nestjs/throttler`.
- Protection bruteforce login : `/auth/login` limite a `10/min/IP` + verrouillage
  du compte apres 5 echecs (`429`), voir `AuthService`.
- Middleware global : chaque requete Core est ajoutee dans une fenetre glissante
  de 5 minutes.
- Nginx interroge le Core en `auth_request` (`/security/ingest`) AVANT de servir
  un segment `/hls/`. Si le Core repond `403` (scraping dur), nginx refuse le
  segment : le blocage est donc REEL, pas seulement une alerte.
- `scrape-segments.sh` appelle aussi `/security/ingest` apres chaque segment pour
  rester demonstrable sur une origine locale sans nginx.
- Dashboard JSON : `GET /security/dashboard` — protege, reserve a un compte admin
  (JWT `role=admin`, ex. `alice`). Il expose comptes + IP, donc pas d'acces anonyme.
- Dashboard HTML : `http://localhost:3000/security.html` (se connecte avec un
  compte admin puis interroge le dashboard avec le token).

## Confiance de l'IP (X-Forwarded-For)

L'IP utilisee par les regles vient de `X-Forwarded-For`, honore uniquement derriere
un proxy de confiance (`TRUST_PROXY`, voir `main.ts` : loopback + reseaux prives en
demo/Docker). Un client direct non fiable ne peut donc pas usurper son IP pour
contourner ou empoisonner la detection. En prod : limiter `TRUST_PROXY` au seul
sous-reseau du reverse-proxy et reecrire l'en-tete entrant cote nginx.

## Regles

| Regle | Seuil demo | Action |
|---|---:|---|
| Sessions simultanees anormales | plus de 3 IP distinctes pour un compte sur 5 min | alerte `multi_session`, flag |
| IP proxy/VPN suspecte | IP ou CIDR present dans `backend/data/proxy-ips.txt` | alerte `proxy_ip`, flag |
| Scraping de segments | plus de 8 requetes `.ts` sur 60s | alerte `segment_scrape`, flag |
| Scraping dur | plus de 20 requetes `.ts` sur 60s | alerte `segment_scrape` + `block` ; nginx refuse le segment (`403`) via `auth_request` |

## Scripts de demo

```bash
./scripts/attacks/multi-session.sh
./scripts/attacks/proxy-ip.sh
./scripts/attacks/scrape-segments.sh
./scripts/attacks/flood.sh
```

Pour declencher la reputation proxy :

```bash
./scripts/attacks/proxy-ip.sh
```

## Avant / apres

Avant P2-B, les floods et lectures rapides n'avaient ni blocage global ni
visibilite temps reel. Apres P2-B :

- un flood finit en `429`;
- une lecture depuis une IP de reputation produit une alerte `proxy_ip`;
- un compte vu depuis trop d'IP produit `multi_session`;
- une rafale de segments `.ts` produit `segment_scrape` puis, au-dela du seuil dur,
  nginx refuse le segment (`403`) via `auth_request` — blocage reel et visible.

## Faux positifs

- Reseaux d'entreprise, NAT et VPN legitimes peuvent faire monter le nombre d'IP.
- Une liste proxy hors-ligne devient stale ; elle sert ici de preuve de concept.
- Le scraping de segments peut ressembler a un player agressif ou a une reprise
  de lecture instable.

## Limites assumees

- La capture d'ecran ou la capture HDMI est quasi indetectable cote serveur.
- Le watermark est dissuasif et tracable, pas une protection cryptographique.
- Le store est en memoire : il est perdu au redemarrage et non partage entre
  plusieurs instances.
- Les seuils sont volontairement bas pour la demo ; ils doivent etre calibres en
  production avec des logs reels.
