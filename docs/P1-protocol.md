# P1 — Protocole d'échange temps réel (revue collaborative)

> Livrable C du `todo/PLAN-AMOS.md`. Source de vérité : `frontend/src/lib/collab.js`
> et `frontend/src/lib/useReview.js`. Ce document met au propre le protocole ; il
> ne l'invente pas. Toute divergence = le code fait foi.

## 1. Transport (contrat abstrait)

L'UI ne dépend jamais d'un transport concret. `createTransport(session, { mode })`
(`collab.js:132`) expose un contrat unique :

```js
const t = createTransport(session, { mode })
t.post({ type, from, payload })     // émet à TOUS les autres pairs
const off = t.subscribe((msg) => …) // reçoit les messages des autres pairs
t.close()
```

Trois implémentations, même contrat :

| Mode | Portée | Quand |
|---|---|---|
| `broadcast` (défaut) | Fenêtres/onglets du **même navigateur**, 100 % offline, zéro backend | Démo mono-machine (`collab.js:28`) |
| `socket` | **LAN 2-3 machines** via la gateway NestJS `ReviewGateway` (room `session`) | `VITE_COLLAB_MODE=socket` (`collab.js:58`) |
| `none` | Transport inerte (mono-fenêtre) | Repli si `BroadcastChannel` absent (`collab.js:139`) |

**Règle anti-écho (invariant clé).** Un transport ne réémet jamais à l'expéditeur.
Chaque message porte `from` (id auteur) ; à la réception, on ignore ses propres
messages : `if (!msg || msg.from === selfRef.current.id) return` (`useReview.js:153`).
Côté `socket`, le serveur relaie aux **autres** membres de la room uniquement (pas
d'écho serveur, `collab.js:56`).

## 2. Enveloppe d'un message

```json
{ "type": "note:add", "from": "1", "payload": { … } }
```

- `type` : voir catalogue ci-dessous.
- `from` : id de l'auteur (`user.id`, sinon `username`, sinon id court).
- `payload` : dépend du `type`.

## 3. Catalogue des messages

### 3.1 Présence & session

| `type` | Émis par | `payload` | Effet à la réception |
|---|---|---|---|
| `join` | Nouvel arrivant, à la connexion (`useReview.js:268`) | `self { id, name, role, color }` | On l'enregistre, on lui renvoie `presence` + `sync:state` ; si je présente, je lui envoie `wt:state` |
| `presence` | Ping périodique toutes les 3 s (`PRESENCE_PING_MS`, `useReview.js:271`) | `self { id, name, role, color }` | Rafraîchit `lastSeen` du pair |
| `leave` | `beforeunload` (`useReview.js:296`) | `{ from }` (pas de payload) | Retire le pair ; si c'était le présentateur, libère la main |
| `cursor` | Mouvement souris, throttlé 55 ms (`sendCursor`) | `{ x, y, name, color }` (coords **normalisées 0..1**) | Positionne le curseur distant |

> Pairs silencieux (fermeture brutale) purgés après `PRESENCE_TIMEOUT_MS = 9000` ms
> (`useReview.js:275`).

### 3.2 Notes (commentaires + dessins)

| `type` | Émis par | `payload` | Effet |
|---|---|---|---|
| `note:add` | `addNote`, `updateNote` | note complète | Upsert par `id` (l'édition réutilise `note:add`, même `id` → remplacement, pas de doublon) |
| `note:reply` | `replyToNote`, `addReply`, `deleteReply` | note complète (avec `replies[]` à jour) | Upsert par `id` |
| `note:resolve` | `resolveNote` | note complète (`resolved` à jour) | Upsert par `id` |
| `note:remove` | `removeNote` | `{ id }` | Retire la note |
| `note:like` | `toggleLike` | note complète (`likes[]` à jour) | Met à jour `likes` de la note ciblée |
| `note:update` | `updateNoteShapes` (gomme, clear) | `{ id, shapes }` | Remplace les `shapes` de la note |
| `sync:state` | `join` (réponse) + `replaceNotes` (réimport JSON) | `{ notes: [...] }` | Fusionne l'ensemble reçu (upsert par `id`, tri par `time`) |

### 3.3 Watch Together (le présentateur pilote, les invités suivent)

| `type` | Émis par | `payload` | Effet (invités seulement) |
|---|---|---|---|
| `wt:claim` | `claimPresenter` | `{ from }` | `from` devient le présentateur unique |
| `wt:release` | `releasePresenter` | `{ from }` | Plus de présentateur |
| `wt:state` | Présentateur, en réponse à un `join` (retardataire) | `{ presenterId, playback, selectedNoteId }` | Resynchronise lecture + note active |
| `wt:playback` | `sendPlayback` (play/pause/seek) | `{ action, position, at }` | Applique la commande de lecture |
| `wt:heartbeat` | `sendHeartbeat` (anti-dérive) | `{ position, paused, rate, at }` | Recale la lecture (seuil de dérive 0,4 s) |
| `wt:rate` | `sendRate` | `{ rate }` | Applique la vitesse de lecture |
| `wt:select` | `sendSelect` | `{ noteId }` | Aligne la note active (mêmes dessins affichés) |

**Anti-usurpation.** Les messages `wt:*` (hors `claim`/`release`) ne sont appliqués
que s'ils viennent du présentateur courant :
`if (msg.from === presenterIdRef.current)` (`useReview.js:241, 246, 252, 259`).

## 4. Cycle de vie d'une session (résumé)

1. À l'ouverture : `join` → les pairs répondent `presence` + `sync:state` (état
   courant des notes) → le nouvel arrivant est amorcé.
2. En continu : `presence` (3 s), `cursor` (throttlé), mutations `note:*`.
3. Watch Together (optionnel) : un pair fait `wt:claim`, diffuse `wt:playback` /
   `wt:heartbeat` / `wt:select` ; les invités suivent, contrôles verrouillés.
4. À la fermeture : `leave` (ou purge après 9 s de silence).

## 5. Persistance (complément, hors temps réel)

Les notes sont aussi persistées côté serveur **par session** (`frontend/src/lib/notes.js`
→ `GET/PUT /notes/:session`) et miroir `localStorage`. Le temps réel converge les
pairs connectés ; la persistance fait survivre les notes au départ de tous les pairs.
Détail : `useReview.js:108-137`.
