# Audit — branche `feat/intelligence-artificielle-data` (Engine P3 IA/Data)

Date : 2026-07-01 · Périmètre : `engine/` (+ `docs/`) · Base : `origin/master`
Diff : 57 fichiers, +2463 / -1 · 6 commits · Auteur : eragonrd

## Verdict

Branche **mergeable proprement** (HEAD contient tout master). Socle Engine
solide et cohérent avec le contrat P3-A. **Aucun bloquant.** 2 points élevés
(reproductibilité, poids git) à traiter avant merge idéalement.

## Points forts

- Auth : refus par défaut, JWT HS256 aligné sur le Core, test « token forgé » (401).
- Contrat P3-A respecté : `schemas.py` (Pydantic) + `contract.py` (jsonschema) + tests de conformité.
- Async job + polling adapté (transcription/LLM longs) ; sorties 1 dossier/vidéo + cache incrémental multilingue.
- Modèles : chargement paresseux, singletons, double-checked locking ; `unload_llm` avant NLLB (RAM).
- Docker CPU-only (torch CPU index, `.dockerignore` exclut `tests/` et `models/`).
- Tests rapides (API + contrat) séparés des tests lourds (modèles).

## Findings

| # | Sévérité | Fichier | Constat | Reco |
|---|---|---|---|---|
| E1 | Élevé | `engine/requirements.txt` | Aucune version épinglée (fastapi, torch, transformers, pydantic, llama-cpp...). ML = API instables → build non reproductible. | Épingler (`pip freeze` cible py3.10) ou plages `>=,<`. |
| E2 | Élevé | `engine/tests/examples/*.mp4` | 56 Mo de binaires commités (13+25+18). Exclus de l'image mais **dans l'historique git à jamais**. | git-lfs, ou retirer + fixtures externes/URL. |
| M1 | Moyen | `pipeline.analyze` + `models.py` | `unload_llm()` (met `_llm=None` sous lock) alors que N jobs tournent en threads daemon → un thread libère le LLM utilisé par un autre → crash/None. | Sérialiser le pipeline (lock global / file) ou ne pas unload en multi-job. |
| M2 | Moyen | `main.py /analyze-path` | Utilisateur authentifié → analyse **tout chemin local serveur** (copié dans `outputs/`). Vecteur lecture arbitraire. | Restreindre à un dossier autorisé ; désactiver hors démo (flag). |
| M3 | Moyen | `main.py JOBS` | Store en mémoire non borné, non persistant → fuite lente + perte au restart. | TTL/éviction (acceptable hackathon, à noter). |
| F1 | Faible | `summarize.translate()` | Code mort (traduction LLM remplacée par NLLB `translate_all`). | Supprimer. |
| F2 | Faible | `_parse_chapters` | Ne force pas le 1er chapitre à `start=0` (exigé par prompt/contrat). | Forcer `chapters[0].start = 0`. |
| F3 | Faible | `pipeline.analyze` (cache hit) | Recharge l'embedder pour `build_index` même quand tout est en cache. | Reconstruire l'index à la 1re recherche seulement. |
| F4 | Faible | `summarize.summarize` | `transcript[:4000]` → longues vidéos : résumé biaisé début. | Map-reduce/chunks (baseline OK à noter). |
| F5 | Faible | `nlp/translate.py` | `forced_bos_token_id` via `convert_tokens_to_ids` : fragile selon version `transformers`/NLLB. | Verrouiller la version (cf. E1) + test de non-régression. |

## Tests

Non exécutables dans cet environnement (Python 3.14 local incomplet : `referencing`
manquant). Cible réelle = **Python 3.10** (Dockerfile). Tests rapides bien conçus
(pas de chargement modèle) ; tests `e2e`/`examples` dépendent des fixtures lourdes (cf. E2).
À lancer en CI/Docker avant merge.

## Recommandation

Merge acceptable pour la soutenance. **Avant merge** : traiter E1 (pins) et E2
(binaires). **Après** : M1 (concurrence) et M2 (durcir `/analyze-path`).

---

## Vérification post-merge (2026-07-01)

> La branche est désormais **fusionnée sur `master`**. État de chaque finding
> re-vérifié dans le code actuel. « Non revérifié » = pas contrôlé cette passe
> (pas d'affirmation sans preuve).

| # | Statut | Preuve dans le code actuel |
|---|---|---|
| E1 | ❌ **Ouvert** | `engine/requirements.txt` : toujours aucune version épinglée |
| E2 | ❌ **Ouvert** | `git ls-files` : `cours-anglais.mp4`, `speech1.mp4`, `test-espagnol.mp4` encore suivis ; présents dans l'historique (`b8e8858`) |
| M1 | ❌ **Ouvert** | `unload_llm()` toujours appelé dans le flux (`pipeline.py:55`) ; aucune sérialisation de jobs trouvée → la course subsiste si ≥ 2 jobs concurrents |
| M2 | ✅ **Corrigé** | `main.py:83-90` : `/analyze-path` désactivé si `ANALYZE_PATH_BASE` absent (403) + `realpath` + `os.path.commonpath([base, target]) == base` (anti-traversal) |
| M3 | ⚠️ **Ouvert (accepté hackathon)** | `main.py:37` `JOBS: dict = {}` — toujours en mémoire, sans TTL/éviction |
| F1 | ❌ **Ouvert** | `summarize.py:52` : `def translate(...)` toujours présent (code mort présumé, remplacé par NLLB) |
| F2 | ❌ **Ouvert** | `_parse_chapters` (`summarize.py:116+`) ne force pas `chapters[0].start = 0` ; seul le prompt le demande |
| F3 | ➖ Non revérifié | — |
| F4 | ➖ Non revérifié | — |
| F5 | ➖ Non revérifié | — |

**Reste à faire (priorité)** : E1 (pins) et E2 (binaires/git-lfs) avant tout gel ;
M1 (sérialiser le pipeline ou ne pas `unload` en multi-job). M2 est réglé.
