# P1 — Format d'export / import JSON des revues

> Livrable B du `todo/PLAN-AMOS.md`. Source de vérité : `frontend/src/components/VideoReview.jsx`
> (`exportJSON` `:370`, `importJSON` `:388`) et `frontend/src/lib/useReview.js`
> (fabrique des notes). Reprend le format déjà décrit dans `frontend/REFONTE-UI.md`,
> ici dans un document dédié et réutilisable.

## 1. À quoi ça sert

Une revue exportée est un fichier `.json` autonome : archivage, reprise ultérieure,
partage hors ligne, ou réimport dans une fenêtre neuve. Les coordonnées de dessin
sont **normalisées 0..1** (indépendantes de la résolution d'affichage), donc l'export
se rejoue fidèlement sur n'importe quel écran.

Nom de fichier produit : `revue-<session>.json` (`VideoReview.jsx:383`).

## 2. Enveloppe

```json
{
  "version": 1,
  "session": "demo-42c",
  "exportedAt": "2026-06-30T10:00:00.000Z",
  "notes": [ /* … */ ]
}
```

| Champ | Type | Notes |
|---|---|---|
| `version` | number | Vaut **1** (`VideoReview.jsx:372`). Champ de compatibilité future. |
| `session` | string | Identifiant de la session de revue. |
| `exportedAt` | string (ISO 8601) | Horodatage de l'export. |
| `notes` | array | Liste des notes (voir §3). |

## 3. Une note

```json
{
  "id": "a1b2c3d4",
  "time": 42.7,
  "author": { "id": "1", "name": "alice", "color": "#4d9bff" },
  "text": "Le logo est trop petit ici.",
  "color": "#f5a623",
  "resolved": false,
  "replies": [
    {
      "id": "r1e2p3",
      "author": { "id": "2", "name": "bob", "color": "#29c5e6" },
      "text": "Je confirme, à agrandir.",
      "createdAt": "2026-06-30T10:01:00.000Z"
    }
  ],
  "shapes": [ /* voir §4 */ ],
  "createdAt": "2026-06-30T09:59:00.000Z",
  "updatedAt": "2026-06-30T10:02:00.000Z",
  "likes": [ { "id": "2", "name": "bob" } ]
}
```

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `id` | string | oui | Id court unique ; clé d'upsert du temps réel. |
| `time` | number (s) | oui | Instant dans la vidéo. **Filtre d'import** : une entrée sans `time` numérique est rejetée (`useReview.js:487`). |
| `author` | `{ id, name, color }` | oui | Auteur de la note. |
| `text` | string | non | Commentaire (peut être vide si dessin seul). |
| `color` | string (hex) | non | Couleur de la note (défaut = couleur de l'auteur). |
| `resolved` | boolean | non | Statut résolu / ouvert (défaut `false`). |
| `replies` | array | non | Fil de réponses (voir ci-dessous). |
| `shapes` | array | non | Dessins rattachés (voir §4). |
| `createdAt` | string (ISO) | oui | Création. |
| `updatedAt` | string (ISO) | non | Présent après édition / réponse / résolution. |
| `likes` | array `{ id, name }` | non | Présent seulement si au moins un like. |

Réponse (`replies[]`) : `{ id, author { id, name, color }, text, createdAt }`.

## 4. Formes de dessin (`shapes[]`)

Coordonnées **normalisées 0..1**. Cinq outils (`DrawingCanvas.jsx`, `VideoReview.jsx` `TOOLS`) :

```json
[
  { "tool": "arrow",   "color": "#f5a623", "from": {"x":0.4,"y":0.3}, "to": {"x":0.55,"y":0.42} },
  { "tool": "rect",    "color": "#f5a623", "from": {"x":0.1,"y":0.1}, "to": {"x":0.3,"y":0.25} },
  { "tool": "ellipse", "color": "#29c5e6", "from": {"x":0.5,"y":0.4}, "to": {"x":0.7,"y":0.6} },
  { "tool": "text",    "color": "#f4f6fa", "at": {"x":0.45,"y":0.2}, "value": "À revoir" },
  { "tool": "pen",     "color": "#ff5b5b", "points": [{"x":0.2,"y":0.2}, {"x":0.22,"y":0.23}] }
]
```

| `tool` | Géométrie |
|---|---|
| `arrow` | `from` → `to` |
| `rect` | `from` → `to` (coins opposés) |
| `ellipse` | `from` → `to` (boîte englobante) |
| `text` | `at` (point d'ancrage) + `value` (chaîne) |
| `pen` | `points[]` (trait libre) |

## 5. Import (tolérance)

`importJSON` (`VideoReview.jsx:388`) accepte **deux formes** :

1. l'enveloppe complète `{ version, session, exportedAt, notes }` → utilise `notes` ;
2. un **tableau nu** de notes (`[ … ]`) → utilisé tel quel.

Toute autre forme (`notes` absent et racine non-tableau) lève « format invalide ».
À l'import, `replaceNotes` filtre les entrées sans `time` numérique, trie par `time`,
remplace l'état local **et** le diffuse aux pairs (`sync:state`).
