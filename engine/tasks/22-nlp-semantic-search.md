# Tâche 22 — Recherche sémantique + traduction · Responsable : Izlene

## Objectif
Rendre la vidéo *trouvable* : indexer les segments en embeddings, permettre « le passage où on parle de X », et fournir une **traduction**.

## Entrées / Sorties
| Entrées | Sorties |
|---|---|
| `transcript`, `segments[]` (tâche 20) | `translation` (champ contrat), index d'embeddings, réponses `/search` (segments + timecodes) |

## Dépendances
- Bloquée par : 00, 20.
- Alimente : 10 (`POST /search`), View (saut à l'instant).

## Étapes (checklist)
- [ ] ❌ Charger `sentence-transformers` (modèle multilingue léger, ex. `paraphrase-multilingual-MiniLM`)
- [ ] ❌ Calculer un embedding par segment → index (mémoire ou FAISS si le temps)
- [ ] ❌ Fonction de recherche : query → top-k segments + scores + timecodes
- [ ] ❌ Traduction du transcript (modèle léger ou LLM tâche 21) → `translation`
- [ ] ❌ Module `app/nlp/search.py` : `build_index(segments)`, `search(query, k)`
- [ ] ❌ Test : requête thématique → segment attendu retourné

## Critères « fait »
- Une requête en langage naturel renvoie les bons segments avec timecode.
- `translation` remplie et lisible.
- Multilingue géré (requête FR sur contenu EN ok).

## Notes / pièges
- Normaliser les embeddings (cosine).
- Modèle multilingue impératif pour le cross-langue.
- FAISS optionnel : un argmax numpy suffit pour la démo.
