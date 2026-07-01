# Estimations de performance — Pipeline P3-A (mesuré sur i5-1145G7)

> Chiffres **calibrés par benchmark réel** (`bench_pipeline.py` sur `media/42 - POC Parc des Princes V1 .mp4`, 87 s). Machine : Intel i5-1145G7 (4c/8t), CPU-only, n_threads=4.

## 1. Constantes mesurées (le socle des estimations)
| Étape | Vitesse mesurée | Modèle |
|---|---|---|
| Extraction audio (ffmpeg) | 0,17 s (≈ constant) | — |
| **Transcription** Whisper `base` int8 | **RTF = 0,069** → `temps ≈ 0,07 × durée_audio` | ×14,6 temps réel |
| **LLM** Qwen2.5-1.5B Q4 (génération) | **9,1 tok/s** | `temps ≈ tokens_sortie / 9` |
| Embeddings MiniLM | ~0,02 s/segment (négligeable) | — |

> ⚠️ Le benchmark ne mesurait **qu'un résumé** (1 appel LLM, 115 tok). Le pipeline complet = **résumé + chapitres + mots-clés** ⇒ plusieurs appels LLM. Les estimations ci-dessous intègrent ce surcoût.

## 2. Modèle de coût par vidéo (pipeline complet)
| Composante | Formule | Remarque |
|---|---|---|
| Extraction | ~0,2 s | constant |
| Transcription | `0,07 × durée` | dépend de la **durée**, pas du nb de mots |
| Résumé (LLM) | `~150 tok / 9` ≈ 17 s + lecture transcript | 1 appel |
| Chapitres (LLM) | `~250 tok / 9` ≈ 28 s + lecture transcript | 1 appel |
| Mots-clés | **KeyBERT ≈ 0,5 s** (sans LLM) | repli léger conseillé |
| Embeddings | `~0,02 × nb_segments` | négligeable |

> Hypothèses : parole « normale » ~140 mots/min ; résumé ~150 tok, chapitres ~250 tok.
> Pour les **transcripts longs** (> ~3000 tokens ≈ 17 min), on **découpe** (map-reduce) → +1 appel LLM par tranche : la part LLM augmente plus vite que linéairement.

## 3. Estimation par durée de vidéo
| Durée vidéo | Transcription | LLM (résumé+chapitres) | Mots-clés+embed | **TOTAL estimé** |
|---|---|---|---|---|
| **1 min** | ~4 s | ~45 s | ~1 s | **~50 s** |
| **87 s (mesuré, résumé seul)** | 6 s | 13 s | 0,4 s | **19 s** ✅ réel |
| **3 min** | ~13 s | ~55 s | ~1 s | **~70 s (~1,2 min)** |
| **5 min** | ~21 s | ~70 s | ~2 s | **~95 s (~1,6 min)** |
| **10 min** | ~42 s | ~2 min (chunking) | ~3 s | **~3 min** |
| **15 min** | ~63 s | ~3,5 min (chunking) | ~4 s | **~5 min** |
| **30 min** | ~2,1 min | ~7 min (chunking) | ~6 s | **~9–12 min** |

> 🔑 **Le LLM domine**, surtout en vidéo longue. La transcription reste très rapide (RTF 0,07).

## 4. Estimation par média candidat
| Média | Durée | Estimation pipeline complet |
|---|---|---|
| `media/42 - POC Parc des Princes V1 .mp4` | 87 s | **~35–45 s** (peu de parole : 11 seg / 119 mots) |
| `media/sample.mp4` (démo 42c, à DL) | ~3–5 min (hyp.) | **~1,5–2 min** |
| Sintel clip (CC-BY, configurable) | ~1–2 min | **~50 s–1,5 min** |
| `data/videos.csv` v01 (447 s) | 7,5 min | ~2,5 min *(rappel : P3-B = logs, pas de transcription requise)* |
| `data/videos.csv` v02–v03 (172/135 s) | ~2–3 min | ~1–1,2 min |

## 5. Coûts uniques (one-time, hors estimation par vidéo)
| Élément | Coût | Quand |
|---|---|---|
| DL Whisper `base` | ~140 Mo / ~9 s | 1er run (fait) |
| DL MiniLM multilingue | ~470 Mo / ~43 s | 1er run (fait) |
| GGUF Qwen2.5-1.5B Q4 | 1,1 Go | fait |
| Chargement modèles (**à chaud**) | Whisper ~1–2 s · llama 1,65 s · MiniLM ~2–4 s | à chaque démarrage process |

## 6. Empreinte RAM (pic)
| Modèle résident | RAM ~ |
|---|---|
| Whisper base int8 | ~0,5–1 Go |
| llama 1.5B Q4 (n_ctx 4096) | ~1,5–2 Go |
| MiniLM | ~0,5 Go |
| **Les 3 simultanés** | **~3–3,5 Go** → tient dans ~4 Go libres, mais **juste** |

> Recommandation : charger les modèles **paresseusement** et/ou libérer Whisper avant d'appeler le LLM si la RAM sature. Garder les modèles en **singleton** (pas de rechargement par requête).

## 7. Leviers d'optimisation (si trop lent)
| Levier | Effet |
|---|---|
| Whisper `tiny` au lieu de `base` | ~2× plus rapide, qualité moindre |
| `beam_size=1` (déjà) + `vad_filter=True` | saute les silences → moins d'audio à traiter |
| Mots-clés **KeyBERT/TextRank** (pas LLM) | économise 1 appel LLM |
| `n_threads=8` à tester | possible gain prompt-eval |
| Résumé **map-reduce** borné | limite l'explosion sur vidéos longues |
| Qwen2.5-**0.5B** (repli) | LLM ~2× plus rapide, qualité moindre |

## 8. Conclusion
- Vidéos **courtes (≤ 5 min)** : pipeline complet **< 2 min** → confortable pour la démo.
- Vidéos **longues (15–30 min)** : **5–12 min**, dominé par le LLM → prévoir traitement **asynchrone** + barre de progression (cf. T10).
- Pour la **soutenance**, viser une vidéo de **1–3 min avec vraie parole** (`media/sample.mp4`) : rendu riche en < 2 min.
