# Contrat Core ⇄ Engine ⇄ Front (métadonnées IA)

> Destiné au **pôle Core (NestJS)**. Décrit ce que le Core doit **construire** pour
> brancher l'IA (Engine, Pôle 3) au front (Pôle 1). L'API Engine, elle, existe déjà.

## Contexte et état réel (vérifié)

- **Engine** (`engine/`, FastAPI `:8000`) : **implémenté et testé**. Voir le contrat
  brut `engine/docs/api-contract.md`. Modèle **asynchrone par job** (`job_id`),
  analyse longue (~4 min pour ~9 min de vidéo).
- **Front** (`frontend/`) : raisonne par **`contentId`** (ex. `poc`), jamais par `job_id`,
  et ne peut pas faire poireauter l'utilisateur plusieurs minutes.
- **Core** (`backend/src/`) : **aucune intégration Engine à ce jour** (constat : zéro
  occurrence de `8000` / `/analyze` / `/jobs` / `ENGINE_URL`). Tout ce document est **à créer**.

Le Core est le **pont** : il absorbe l'asynchronisme et l'auth de l'Engine et expose au
front une API simple, synchrone-en-apparence, sécurisée par les droits déjà en place.

---

## Partie A — Ce que le Core CONSOMME de l'Engine (déjà prêt)

Référence complète : `engine/docs/api-contract.md`. Résumé utile :

| Méthode | Engine | Corps | Retour |
|---|---|---|---|
| POST | `/analyze` | `multipart/form-data: file` | `{ job_id, status:"processing" }` |
| POST | `/analyze-path` | `{ path }` (fichier local, dev) | idem |
| GET | `/jobs/{job_id}` | — | `{ status: processing\|done\|error, result?, error?, output_dir? }` |
| POST | `/search` | `{ job_id, query, k }` | `{ query, hits:[{start,end,text,score}] }` |

- **Auth** : le Core **relaie le JWT** de l'utilisateur (`Authorization: Bearer <jwt>`).
  Même `JWT_SECRET` HS256 des deux côtés (déjà le cas). L'Engine désactive la vérif `sub`.
- **Config Core à ajouter** : `ENGINE_URL` (défaut `http://localhost:8000`).

> ⚠️ **L'Engine analyse la vidéo EN CLAIR** (piste audio), pas le HLS chiffré. Le Core doit
> donc envoyer la **source d'origine** (le `.mp4` avant chiffrement), pas le flux `/videos/:id`.
> → l'analyse se déclenche naturellement **au moment de l'ingestion** (là où le fichier clair
> existe encore), en amont ou en parallèle du chiffrement HLS.

---

## Partie B — Ce que le Core EXPOSE au Front (à implémenter)

API **par `contentId`**, protégée par l'ACL contenu existante (`ContentsService.isAllowed`
+ isolation entreprise). Le front ne voit jamais un `job_id`.

### 1) `GET /contents/:id/metadata`
Récupère les métadonnées IA d'un contenu.

| Cas | Code | Corps |
|---|---|---|
| Analyse terminée | `200` | `VideoMetadata` (contrat P3-A, cf. plus bas) |
| Analyse en cours | `202` | `{ status: "processing" }` |
| Pas encore analysé | `404` | `{ status: "not_analyzed" }` (ou déclenche l'analyse, voir décisions) |
| Échec d'analyse | `409` | `{ status: "error", error }` |
| Pas les droits / autre tenant | `403` / `404` | (isolation, comme `/contents`) |

### 2) `POST /contents/:id/search`
Recherche sémantique dans le contenu analysé.

- Corps : `{ query: string, k?: number = 3 }`
- `200` → `{ query, hits: [{ start, end, text, score }] }`
- `409` (ou `425 Too Early`) si le contenu n'est pas encore `done`.
- Le Core relaie vers l'Engine `/search` avec le **`job_id` mémorisé** pour ce `contentId`.

### 3) (Optionnel) `POST /contents/:id/analyze`
Déclenche / relance l'analyse (réservé admin d'entreprise). Utile si on ne déclenche pas
automatiquement à l'ingestion. `202 { status:"processing" }`.

---

## Partie C — Responsabilités internes du Core

1. **Mapping + cache** `contentId → { jobId, status, result, updatedAt }`.
   Persister avec le reste (même approche que `backend/data/*.json`, ou une vraie table
   plus tard). Objectif : ne relancer l'analyse **qu'une fois** par contenu.
2. **Déclenchement de l'analyse** : idéalement **à l'ingestion** (POST `/analyze` vers
   l'Engine avec la vidéo en clair), sinon en **lazy** au 1er `GET /metadata` (retourner
   `202` en attendant). Choix à trancher (voir décisions).
3. **Polling de l'Engine côté Core** : boucle `GET /jobs/{jobId}` (intervalle ~2 s) dans un
   process/worker du Core, PAS dans la requête HTTP du front. Le front, lui, poll
   `GET /contents/:id/metadata` (qui renvoie `202` tant que pas prêt).
4. **Sécurité** : appliquer l'ACL contenu **avant** de relayer (mêmes règles que `/contents`
   et `/keys`) → un utilisateur ne lit les métadonnées que d'un contenu auquel il a accès.
   Un superadmin (sans entreprise) n'a pas accès (cohérent avec la séparation en place).
5. **Relais JWT** : transmettre le token de l'utilisateur à l'Engine (ou un token de service
   dédié Core→Engine ; à décider — le partage de secret existe déjà).

---

## Schéma `VideoMetadata` (contrat P3-A)

Source de vérité : `docs/P3A-metadata-schema.md` + `engine/app/schemas.py`.

```json
{
  "video": "poc.mp4",
  "language": "fr",
  "duration_sec": 87.2,
  "transcript": "Texte intégral…",
  "segments": [{ "start": 0.0, "end": 4.2, "text": "…" }],
  "translation": { "lang": "en", "text": "…" },
  "translations": [
    { "lang": "fr", "text": "…", "segments": [{ "start": 0.0, "end": 4.2, "text": "…" }] },
    { "lang": "en", "text": "…", "segments": [ … ] }
  ],
  "summary": "Résumé court.",
  "chapters": [{ "title": "Introduction", "start": 0.0 }],
  "keywords": ["stade", "sécurité"],
  "generated_at": "2026-06-30T10:00:00Z"
}
```

Ce que le front en fait : `chapters` → marqueurs timeline (jump-to) ; `translations[lang].segments`
→ sous-titres ; `summary` + `keywords` → sous le titre ; `/search` → saut au timecode.

---

## Décisions à trancher (Core)

1. **Déclenchement** : à l'ingestion (recommandé, mais dépend du pipeline d'upload à venir)
   ou lazy au 1er accès ?
2. **Stockage du `result`** : fichier JSON (rapide, cohérent avec l'existant) ou table DB ?
3. **Token Core→Engine** : relayer le JWT utilisateur, ou un token de service dédié ?
4. **Statut exposé au front** : juste `200/202/404`, ou un objet `{status, progress}` plus riche ?
5. **Langue des sous-titres** par défaut côté front : `translation` (1re cible) ou langue de l'UI ?

---

## Rappel des limites côté produit (hors périmètre de ce contrat)

- Le **pipeline d'ingestion** (upload réel → chiffrement HLS → stockage) n'existe pas encore ;
  l'analyse IA en dépend (il faut la vidéo en clair). Ces deux chantiers sont à coordonner.
- La **rétention / dashboard (P3-B)** n'est pas implémentée côté Engine (specs seulement) :
  pas de contrat ici tant que l'API n'existe pas.
