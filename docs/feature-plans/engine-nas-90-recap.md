# Recap — Répartition IA sous contrainte NAS à 90 %

> Pôle 3 (IA/Data) · lié à [engine-groq-migration](./engine-groq-migration.md).
> ⚠️ **Clé Groq exposée en chat le 2026-07-01 → à révoquer/régénérer** avant toute
> implémentation. Aucune clé dans le dépôt (`GROQ_API_KEY` via `engine/.env`).

## Problématique
NAS **UGREEN NASync DXP4800 Plus** — Intel Pentium Gold 8505 (1 P-core + 4 E-core,
5c/6t), **8 Go RAM** de base (extensible), 10GbE.
Pendant **l'upload d'une vidéo + son chiffrement AES** (Pôle 2), le NAS est à
**90 % d'utilisation**. Il reste ~10 % CPU et très peu de RAM : **aucune IA lourde
ne peut tourner en local à cet instant**.

Question : quelles IA garder en local, et par quelles API remplacer celles qui ne
peuvent pas rester ?

## Analyse de charge (par modèle)
| Modèle | Fichier | Empreinte locale | Coexiste avec le pic 90 % ? |
|---|---|---|---|
| NLLB traduction (15 langues) | `engine/app/nlp/translate.py` | ~2,5 Go, CPU lourd × N langues | ❌ non |
| Qwen LLM résumé/chapitres | `engine/app/nlp/summarize.py` | ~2,5 Go, génération CPU très lente | ❌ non |
| Whisper transcription | `engine/app/nlp/transcribe.py` | ~1,5 Go, CPU lourd | ❌ non |
| MiniLM embeddings/recherche | `engine/app/nlp/search.py` | ~0,5 Go, rafales courtes | ⚠️ limite (jouable) |
| KeyBERT mots-clés | `engine/app/nlp/summarize.py` | 0 (réutilise MiniLM) | ⚠️ limite (jouable) |

## Décision de répartition

### IA gardées EN LOCAL
| Modèle | Rôle | Justification |
|---|---|---|
| **MiniLM** | embeddings + recherche sémantique | Le plus léger (~0,5 Go) ; alimente la transcription cliquable côté front |
| **KeyBERT** | mots-clés | Coût nul (réutilise MiniLM) |

### IA REMPLACÉES par API (trop lourdes à 90 %)
| Modèle local | Remplacé par | Clé | Note |
|---|---|---|---|
| Whisper (~1,5 Go) | **Groq `whisper-large-v3-turbo`** | Groq (déjà en main) | timestamps natifs, mapping drop-in |
| Qwen LLM (~2,5 Go) | **Groq `openai/gpt-oss-20b`** | Groq (même clé) | `llama-3.3-70b` déprécié 2026-06-17 |
| NLLB (~2,5 Go) | **Groq `gpt-oss` (prompt)** ou service dédié **Gemini / DeepL** | à trancher | qualité ar/zh/ja moyenne sur LLM ; quota TPD limitant |

## Réponse à la problématique (point clé)
Une fois les **3 modèles lourds** déportés sur API, la charge **locale** de l'IA
retombe à **≈ I/O réseau + extraction/compression audio ffmpeg (courte)** →
**négligeable**.
⇒ Le pipeline IA peut alors **tourner en même temps** que le pic de chiffrement à
90 %, ce qui serait **impossible en 100 % local** (contention CPU/RAM, risque OOM).

Le seul poids local restant = **MiniLM (~0,5 Go)**, qui à 8 Go pendant le
chiffrement est **juste**. Deux garde-fous :
1. **Différer l'indexation** MiniLM (file d'attente : l'analyse démarre quand le
   chiffrement est terminé, quand le NAS repasse sous 90 %).
2. **+8 Go de RAM** (→ 16 Go) : supprime la contrainte pour MiniLM.
3. (Repli extrême) passer aussi les embeddings sur API (Gemini/Cohere) — non
   retenu aujourd'hui, MiniLM conservé.

## Limites Groq Free Tier (vérifiées 2026-07-01 · niveau organisation, non cumulables)
| Modèle | Usage | RPM | RPD | TPM | TPD / Audio |
|---|---|---|---|---|---|
| `whisper-large-v3-turbo` | transcription | 20 | 2 000 | — | 7 200 s/h · 28 800 s/j |
| `openai/gpt-oss-20b` | résumé/chapitres | 30 | 1 000 | 8 000 | 200 000/j |
| `llama-3.1-8b-instant` | gros volume | 30 | 14 400 | 6 000 | 500 000/j |

Impact traduction : `gpt-oss` 200K TPD ⇒ 15 langues × ~6K tokens ≈ **90K/vidéo ⇒
~2 vidéos/jour** ; TPM 8K ⇒ découper (1 langue/requête, segments batchés).

## Synthèse
| Question | Réponse |
|---|---|
| IA gardées en local | **MiniLM + KeyBERT** |
| IA remplacées par API | **Whisper, LLM résumé/chapitres, traduction** |
| Fournisseur principal | **Groq** (transcription + LLM), clé déjà disponible |
| À trancher | traduction : Groq-seul vs Gemini/DeepL (recherche en cours) |
| Condition de coexistence avec le pic 90 % | IA lourde en API ⇒ charge locale négligeable ; sécuriser MiniLM (différé ou +8 Go RAM) |

## Résumé Non-Technique
Quand le NAS est déjà très occupé (90 %) par l'envoi et le chiffrement d'une
vidéo, il n'a pas assez de puissance pour faire tourner les gros programmes
d'intelligence artificielle en même temps. On garde donc sur le NAS uniquement le
petit module de **recherche intelligente** (léger), et on confie les tâches
lourdes (**transcription**, **résumé**, **traduction**) à un service en ligne
gratuit et rapide (**Groq**). Résultat : l'analyse peut se faire même pendant que
le NAS chiffre la vidéo, sans le ralentir. Deux précautions : soit lancer la
recherche un peu après le chiffrement, soit ajouter de la mémoire au NAS.
