# État de session & Récap — Engine Pôle 3

> Branche : `feat/intelligence-artificielle-data` · MàJ : 2026-06-30
> **Scope strict : Pôle 3 (Engine).** ⚠️ **Aucun commit / push cette session** (demandé).

## 🎯 Où on en est
**Microservice Engine opérationnel.** Tâches de Rabah (lead) `00` + `10` ✅ terminées et testées. Le pipeline transforme une vidéo en **JSON contrat P3-A + sous-titres multilingues** (fr/en/es/ar), avec API REST sécurisée par le JWT du Core.

## ✅ Fait
| Sujet | Détail |
|---|---|
| Setup 00 | venv CPU-only, nettoyage disque ~60 Go |
| API T10 | FastAPI `/health /analyze /analyze-path /jobs/{id} /search`, auth JWT, jobs async |
| Orchestration | ffmpeg → Whisper → llama.cpp (résumé/chapitres) → KeyBERT → MiniLM |
| **Multilingue** | NLLB-200 : traduction + **sous-titres horodatés**, **15 langues par défaut** (extensible `TARGET_LANGS`) |
| Sortie | 1 **dossier par vidéo** (`outputs/<video>/` : vidéo + `<video>_trad_<lang>.json` + `_meta.json`) |
| **Cache** | dossier existant → pas de régénération ; ajout de langue → **incrémental** ; `FORCE=1` régénère |
| Conteneurisation | `Dockerfile` + `.dockerignore` (microservice attachable au Core) |
| Nettoyage | parasites supprimés, vidéos → `tests/examples/` (corpus versionné) |
| ⚠️ HF token | `HF_TOKEN` possiblement requis si rate-limit au DL des modèles |
| Qualité | résumé langue source, chapitres JSON robustes, mots-clés MMR |
| Tests | **11/11 verts** (API + contrat + E2E) |
| Perf | 9,6 min vidéo / 4 langues = ~230 s (mesuré) |
| Schéma | `engine/docs/architecture.png` (HD, depuis Mermaid) |
| CLI | `scripts/analyze_file.py` → **JSON toujours produit** (`<video>.json`) |

## 🔌 Intégration Core (Enzo)
Même `JWT_SECRET` ; relayer le `Bearer <JWT>` ; `POST /analyze` → poll `/jobs/{id}` → renvoyer à la View. Détail : `engine/docs/api-contract.md`.
⚠️ PyJWT rejette le `sub` numérique du Core → `verify_sub=False` côté Engine.

## ⏳ À faire (autres membres)
| Tâche | Resp. | Objet |
|---|---|---|
| 20/21/22 | Duval/Antoine/Izlene | affiner transcription / résumé-chapitres / recherche |
| 30-33 | Otman/Amina/Faycal/Hassane | Data 3B (rétention, modèle, dashboard) |
| Engine | — | persistance jobs (file de tâches), Dockerfile, RTL arabe côté View |

## ▶️ Reprendre / démontrer
```bash
cd engine && source .venv/bin/activate
.venv/bin/python scripts/analyze_file.py "../data/speech1.mp4"   # JSON multilingue
uvicorn app.main:app --reload                                    # API
.venv/bin/python -m pytest tests/ -q                              # tests
```

## 📌 Git
Tout le travail (tâche 10 + améliorations + multilingue + schéma + docs) **non commité** (consigne). Dernier commit poussé : setup 00 (`362c650`).
