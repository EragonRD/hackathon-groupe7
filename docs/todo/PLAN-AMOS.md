# 🎤 Plan de travail — Amos (P1 · Produit, Doc & PM)

> Profil : SAP / MBA (non-codeur). Rôle : produit, documentation, lecture business,
> **PM transverse** (Bloc B + soutenance). Lead pôle : Alex. Branche : `feat/refonte-ui-revue`.
> Aucune tâche de code ici — tout est rédaction, coordination et préparation de démo.
> Tu t'appuies sur l'existant : `frontend/REFONTE-UI.md` documente déjà l'app et le format d'export.

---

## ✅ Déjà fait (ton point de départ)
- L'app de revue tourne : dessin + commentaires au timecode, export/import JSON,
  collaboration multi-fenêtres (même machine). Voir `frontend/REFONTE-UI.md`.
- Le **format d'export JSON** est déjà décrit (section « Format d'export » du même fichier).

---

## 🎯 Tes livrables (par priorité pour la note)

### A — **Scénario de démonstration** multi-fenêtres (`docs/P1-demo-scenario.md`)
Le barème valorise « une démo multi-fenêtres soignée ». Écris le **script pas-à-pas** :
- Qui joue quoi (3 comptes : `alice` admin, `bob`, `carol` — mdp `password`).
- Séquence exacte : ouvrir la même session dans 2-3 fenêtres → l'un dessine une flèche +
  commente à un instant → les autres le voient en direct → saut au timecode → suppression →
  **export JSON** → réimport dans une fenêtre neuve.
- Le « moment whaou » à mettre en avant et le timing (viser 3-4 min).
- ⚠️ Note honnête à préparer : aujourd'hui le multi-fenêtres est **sur une machine**
  (`BroadcastChannel`) ; le vrai **LAN multi-machines** dépend de la brique socket.io
  (en cours côté Alex). Ne pas promettre le LAN tant qu'il n'est pas branché.

### B — **Doc du format d'export** réutilisable (`docs/P1-export-schema.md`)
Sors le schéma de `REFONTE-UI.md` dans un doc dédié et propre :
- Tableau des champs (`version`, `session`, `exportedAt`, `notes[]` → `id`, `time`,
  `author`, `text`, `color`, `shapes[]`, `createdAt`), types, **coords normalisées 0..1**.
- Un exemple complet commenté + une phrase sur **à quoi ça sert** (réimport, archivage,
  reprise dans un autre outil).

### C — **Doc du protocole temps réel** (`docs/P1-protocol.md`)
Le sujet note « un protocole d'échange documenté ». Liste les messages de `lib/collab.js` /
`lib/useReview.js` (`join`, `presence`, `leave`, `cursor`, `note:add`, `note:remove`,
`sync:state`) : sens, qui émet, qui reçoit, et la règle anti-écho (« on ignore ses propres
messages via `from` »). Demande les détails à Alex/Matthieu, ton rôle est de **mettre au propre**.

### D — **Lecture business** (`docs/P1-business.md`, ~1 page)
- Le problème : retours par e-mail (« à 1:32 le logo est trop petit ») = imprécis, fastidieux.
- La valeur : retour **rattaché à l'instant exact**, en direct, à plusieurs ; export réutilisable.
- Pour qui (équipes montage / formation / présentations internes), gain de temps estimé,
  ce qu'on conseillerait à un créateur de contenu.

### E — **Trame de soutenance** (`docs/P1-pitch.md`)
Plan des slides + qui parle quand : problème → solution → démo live → archi (View/Core/Engine,
le rôle de l'auth partagée) → **Bloc B** (couture avec P2/P3) → limites assumées → next steps.

### F — **PM / Bloc B — checklist d'intégration** (`docs/P1-integration-checklist.md`)
Tu es garant de la « couture ». Liste les points à vérifier avec les autres pôles :
- **P2 (Zero-Trust)** : la `source` du `VideoReview` peut-elle devenir un flux HLS chiffré
  (clé AES demandée au Core avec le token) ? Qui teste, quand ?
- **P3 (IA)** : afficher la transcription sous la timeline + hotspots de rétention sur la barre.
  Quel format JSON l'Engine renvoie-t-il ? Caler le contrat avec Rabah.
- **Auth unique** : un seul login (alice) traverse View → Core → Engine. Scénario à répéter.
- Tableau « action / qui / échéance / état ».

### G — **Matrice de test** avant soutenance (`docs/P1-test-matrix.md`)
Cas à cocher : export→import round-trip fidèle · 3 fenêtres synchronisées · suppression
propagée · curseurs visibles · saut au timecode · rechargement (réhydratation auth) ·
comportement si vidéo absente. Tu fais passer la checklist, tu notes les bugs pour Alex/Matthieu.

---

## ▶️ Méthode
- Tous tes docs vont dans `docs/` (le dossier existe). Format Markdown, comme `REPARTITION.md`.
- Tu n'as pas besoin de faire tourner le code, mais demande une démo à Alex pour les captures.
- Commits sur `feat/refonte-ui-revue`, messages clairs (`docs(P1): scénario de démo`).
- Tu es l'interface avec les leads P2 (Enzo) et P3 (Rabah) pour le Bloc B — relance-les tôt
  sur les **contrats d'interface** (clé AES, format JSON de l'Engine).

---

## 📊 Avancement (MàJ 2026-07-01)

| Livrable | Fichier | État |
|---|---|---|
| A — Scénario de démo | `docs/P1-demo-scenario.md` | ✅ rédigé (à relire/ajuster timing) |
| B — Schéma d'export | `docs/P1-export-schema.md` | ✅ rédigé (ancré dans le code) |
| C — Protocole temps réel | `docs/P1-protocol.md` | ✅ rédigé (ancré dans le code) |
| D — Lecture business | `docs/P1-business.md` | ✅ rédigé (brouillon, chiffres = hypothèses à valider) |
| E — Trame de soutenance | `docs/P1-pitch.md` | ✅ rédigé (aligner le deck `presentations/P1-Frontend-Soutenance.*`) |
| F — Checklist Bloc B | `docs/P1-integration-checklist.md` | ✅ rédigé (ancré sur FRONTEND-INTEGRATION.md) |
| G — Matrice de test | `docs/P1-test-matrix.md` | ✅ rédigé |

> **7/7 livrables rédigés.** A/B/C/F/G ancrés dans le code (sources citées). D/E sont
> des **brouillons** : Amos doit se les approprier (validation business, chiffres réels,
> qui parle quand), et aligner le deck existant sur `P1-pitch.md`. Sans données mesurées,
> aucun pourcentage n'a été inventé.
