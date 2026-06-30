# Choix des modèles — cible : légèreté max (CPU)

## Contrainte machine
| Ressource | Valeur | Conséquence |
|---|---|---|
| CPU | Intel i5-1145G7 (4c / 8t, 2.6 GHz) | Modèles quantifiés CPU uniquement |
| RAM | 15 Go total, **~4 Go libres** en pratique | Empreinte modèle visée **≤ 2-3 Go** |
| GPU | Aucun | **CPU-only** (torch CPU, GGUF) |

## Recommandation par composant

| Composant | Modèle retenu (léger) | Taille disque | RAM ~ | Pourquoi |
|---|---|---|---|---|
| **Transcription** (T20) | `faster-whisper` **base** (int8) | ~140 Mo | ~1-1,5 Go | Bon compromis FR/EN sur CPU ; `small` si qualité insuffisante (~480 Mo) |
| **LLM résumé/chapitres** (T21) | **Qwen2.5-1.5B-Instruct** GGUF **Q4_K_M** | ~1 Go | ~2-2,5 Go | Meilleur rapport qualité/poids en FR sur CPU ; tient dans la RAM libre |
| ↳ repli ultra-léger | **Qwen2.5-0.5B-Instruct** Q4_K_M | ~400 Mo | ~1 Go | Si RAM trop juste ; qualité moindre |
| **Embeddings / recherche** (T22) | `paraphrase-multilingual-MiniLM-L12-v2` | ~470 Mo | ~0,5 Go | Multilingue, léger, rapide CPU |
| **Traduction / sous-titres** (T22) | **NLLB-200-distilled-600M** | ~2,5 Go | ~2,5 Go | 200 langues, 1 seul modèle ; bien meilleur que le LLM en traduction. LLM déchargé avant (RAM) |
| **Mots-clés** (T21) | **KeyBERT** (réutilise les embeddings) ou **TextRank** | 0 (réutilise) | ~0 | Pas de modèle dédié ; TextRank = 0 dépendance lourde |

> Empreinte totale visée : **~1,7 Go disque / ~3 Go RAM** en pic. Tient sur la machine.

## Stratégie torch (clé de la légèreté)
- `torch` par défaut tire **~2,5 Go de wheels CUDA/NVIDIA inutiles** (cause du disque plein).
- → Installer **torch CPU-only** via l'index dédié : `--index-url https://download.pytorch.org/whl/cpu` (~200 Mo).
- → `llama-cpp-python` : wheel **CPU pré-compilé** (`--extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu`) pour éviter la compilation (cmake absent).

## Où récupérer les GGUF (100 % local, gratuit)
- Qwen2.5-1.5B-Instruct-GGUF (Q4_K_M) → Hugging Face `Qwen/Qwen2.5-1.5B-Instruct-GGUF`.
- Déposer le `.gguf` dans `engine/models/`.

## Décision
| # | Choix | Statut |
|---|---|---|
| M1 | Whisper = faster-whisper **base** int8 | proposé |
| M2 | LLM = **Qwen2.5-1.5B-Instruct Q4_K_M** (repli 0.5B) | proposé |
| M3 | Embeddings = MiniLM multilingue | proposé |
| M4 | torch **CPU-only** + llama-cpp wheel CPU | **acté** (légèreté) |
