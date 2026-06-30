# Tâche 21 — Résumé · chapitres · mots-clés · Responsable : Antoine

## Objectif
À partir du transcript, produire un **résumé**, des **chapitres** (titrés + horodatés) et des **mots-clés**, via llama.cpp avec repli NLP classique.

> 🟡 **Baseline améliorée déjà en place** (`app/nlp/summarize.py`) : résumé en **langue source**, chapitres par **échantillonnage + parsing JSON robuste** (repli seulement si échec), mots-clés **MMR** (diversité). Validé sur vidéo EN réelle. **Reste à affiner** : prompts par langue, qualité des titres de chapitres, filtrage stopwords multilingue des mots-clés.

## Entrées / Sorties
| Entrées | Sorties (champs du JSON contrat) |
|---|---|
| `transcript`, `segments[]` (tâche 20) | `summary`, `chapters[]` (`title`, `start`, `end`), `keywords[]` |

## Dépendances
- Bloquée par : 00, 20.
- Alimente : 10 (API).

## Étapes (checklist)
- [ ] ❌ Charger un GGUF quantifié (ex. Mistral-7B Q4 / Qwen) via `llama-cpp-python`
- [ ] ❌ Prompt résumé → `summary` concis et fidèle
- [ ] ❌ Découpage en chapitres : regrouper segments, titrer, horodater (`chapters[]`)
- [ ] ❌ Mots-clés : LLM **ou** KeyBERT/TextRank (repli déterministe, sans LLM)
- [ ] ❌ Module `app/nlp/summarize.py` : `summarize(transcript, segments) -> dict`
- [ ] ❌ Gérer les transcripts longs (chunking + fusion)
- [ ] ❌ Test sur la vidéo `media/`

## Critères « fait »
- `summary` pertinent (pas une recopie du transcript).
- `chapters[]` cohérents et horodatés.
- `keywords[]` pertinents ; repli KeyBERT fonctionnel si LLM indisponible.

## Notes / pièges
- Fixer `n_ctx` selon le modèle ; chunker si dépassement.
- Le repli KeyBERT/TextRank garantit une démo même sans GGUF.
- Limiter la température pour des résumés stables.
