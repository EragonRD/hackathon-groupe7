# Choix des modèles — cible : légèreté max (CPU)

## Contrainte machine
| Ressource | Valeur | Conséquence |
|---|---|---|
| CPU | Intel i5-1145G7 (4c / 8t, 2.6 GHz) | Modèles quantifiés CPU uniquement |
| RAM | 15 Go total, **~4 Go libres** en pratique | Empreinte modèle visée **≤ 2-3 Go** |
| GPU | Aucun | **CPU-only** (torch CPU, GGUF) |

## Architecture retenue : providers distants + local minimal

Le calcul lourd (transcription, LLM, traduction) est **déporté sur des API gratuites**
(Groq en tête) pour ne pas saturer un NAS modeste. Chaque étape choisit son provider
indépendamment (`ENGINE_ASR_PROVIDER`, `ENGINE_LLM_PROVIDER`, `ENGINE_TRANSLATE_PROVIDER`).
Un seul modèle **reste toujours en local** (embeddings) et **un seul modèle local de
transcription** sert de repli offline.

### Providers distants (défaut démo)
| Étape | Provider · modèle | Pourquoi |
|---|---|---|
| **Transcription** | **Groq** `whisper-large-v3-turbo` | 1 s, langue correcte, décharge le NAS |
| **Résumé / chapitres** | **Groq** `openai/gpt-oss-20b` | rapide, bon FR |
| **Traduction** (+ à la demande) | **Groq** `meta-llama/llama-4-scout-17b-16e-instruct` | 30K TPM (absorbe le multi-langues), ar/zh/ja OK |
| *Alternatives sélectionnables* | OpenRouter, Gemini, Mistral (`open-mistral-nemo`), NVIDIA Riva (ASR) | via `.env` |

### Modèles locaux
| Composant | Modèle local | Taille | RAM ~ | Statut |
|---|---|---|---|---|
| **Embeddings / recherche + mots-clés** | `paraphrase-multilingual-MiniLM-L12-v2` (KeyBERT réutilise) | ~470 Mo | ~0,5 Go | **toujours local** |
| **Transcription (repli offline)** | **`faster-whisper small` (int8)** — **UNIQUE modèle local de transcription** | ~480 Mo | ~1 Go | repli |
| Résumé/chapitres (repli) | Qwen2.5-1.5B-Instruct Q4_K_M | ~1 Go | ~2,5 Go | repli optionnel |
| Traduction (repli) | NLLB-200-distilled-600M | ~2,5 Go | ~2,5 Go | repli optionnel |

> **Transcription = un seul modèle local : `small`** (décision figée). `base` trop faible
> (mauvaise détection de langue), `medium/large` trop lents sur NAS, `distil-large-v3`
> écarté (anglais-only). La détection de langue est **fiabilisée par `langdetect`** sur le
> texte transcrit (corrige les faux positifs Whisper, ex. anglais accentué -> `cy`).

> En mode API (défaut), l'empreinte locale se limite à **MiniLM (~0,5 Go)** : le NAS ne
> fait quasi aucun calcul IA. Le repli local (`ENGINE_ALLOW_LOCAL_FALLBACK=true`) n'est
> chargé qu'en cas d'échec API / mode offline.

## Stratégie torch (clé de la légèreté)
- `torch` par défaut tire **~2,5 Go de wheels CUDA/NVIDIA inutiles** (cause du disque plein).
- → Installer **torch CPU-only** via l'index dédié : `--index-url https://download.pytorch.org/whl/cpu` (~200 Mo).
- → `llama-cpp-python` : wheel **CPU pré-compilé** (`--extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu`) pour éviter la compilation (cmake absent).

## Où récupérer les GGUF (100 % local, gratuit)
- Qwen2.5-1.5B-Instruct-GGUF (Q4_K_M) → Hugging Face `Qwen/Qwen2.5-1.5B-Instruct-GGUF`.
- Déposer le `.gguf` dans `engine/models/`.

## Décision (à jour)
| # | Choix | Statut |
|---|---|---|
| M1 | Transcription = **Groq `whisper-large-v3-turbo`** (distant) ; repli **local `small` int8 UNIQUE** + `langdetect` | **acté** |
| M2 | LLM résumé/chapitres = **Groq `openai/gpt-oss-20b`** ; repli Qwen2.5-1.5B | **acté** |
| M3 | Traduction = **Groq `llama-4-scout`** ; repli NLLB-200 | **acté** |
| M4 | Embeddings/recherche/mots-clés = **MiniLM multilingue (local)** | **acté** |
| M5 | torch **CPU-only** + llama-cpp wheel CPU (repli local) | acté (légèreté) |

> Providers alternatifs (OpenRouter, Gemini, Mistral, NVIDIA) branchés et sélectionnables
> par `.env` — cf. `engine/.env.example`.
