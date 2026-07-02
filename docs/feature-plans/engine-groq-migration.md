# Feature — Migration Engine vers Groq (transcription + LLM) & nettoyage

> Slug : `engine-groq-migration` · Pôle 3 (IA/Data) · Doc vivant.
> ⚠️ **Aucune clé API dans ce dépôt.** Le code lit `GROQ_API_KEY` depuis
> l'environnement (`engine/.env`, gitignoré). La clé collée en chat le
> 2026-07-01 est **compromise → à révoquer/régénérer** sur console.groq.com.

## Contexte
Pipeline P3-A (`engine/app/`) : vidéo → transcription → résumé/chapitres/mots-clés
→ traduction 15 langues → embeddings/recherche. Aujourd'hui **100 % local CPU**,
4 modèles lourds sur machine à ~4 Go RAM libres = lent et fragile. Un NAS UGREEN
DXP4800 Plus (Pentium Gold 8505, RAM extensible) est dispo, mais on choisit
d'externaliser le calcul lourd vers **Groq** (clé déjà en main).

## Objectif
Remplacer les 2 modèles les plus gourmands par l'API **Groq**, **conserver MiniLM
en local**, trancher la traduction, et **nettoyer** le code + les dépendances
devenues inutiles, sans casser le contrat JSON P3-A ni les tests.

## Constats

### Modèles actuels (par gourmandise)
| # | Modèle | Fichier | Rôle | RAM pic | Décision |
|---|---|---|---|---|---|
| 1 | NLLB-200-600M | `nlp/translate.py` | traduction 15 langues | ~2,5 Go | **à externaliser** |
| 2 | Qwen2.5-1.5B (llama.cpp) | `nlp/summarize.py` + `models.get_llm` | résumé/chapitres/mots-clés | ~2,5 Go | **→ Groq** |
| 3 | faster-whisper base | `nlp/transcribe.py` + `models.get_whisper` | transcription | ~1,5 Go | **→ Groq** |
| 4 | MiniLM | `nlp/search.py` + `models.get_embedder` | embeddings/recherche | ~0,5 Go | **garder local** |

> `extract_keywords` (KeyBERT) réutilise MiniLM → **reste local**. Seuls résumé +
> chapitres partent sur Groq.

### Capacités Groq (API OpenAI-compatible)
| Peut faire | Ne peut PAS faire |
|---|---|
| Transcription audio (Whisper) + timestamps | Embeddings (pas d'endpoint) → MiniLM reste local |
| Chat LLM (résumé, chapitres, mots-clés, traduction via prompt) | Images, fine-tuning |
| Traduction audio→**anglais uniquement** (Whisper translate) | Traduction texte multi-langues native (à faire via chat LLM) |

### Limites Free Tier (vérifiées 2026-07-01, niveau **organisation**, non cumulables entre clés)
| Modèle | Usage | RPM | RPD | TPM | TPD / Audio |
|---|---|---|---|---|---|
| `whisper-large-v3-turbo` | transcription (rapide/économe) | 20 | 2 000 | — | 7 200 s/h · 28 800 s/j |
| `whisper-large-v3` | transcription (qualité) | 20 | 2 000 | — | 7 200 s/h · 28 800 s/j |
| `openai/gpt-oss-20b` | résumé/chapitres (rapide) | 30 | 1 000 | 8 000 | 200 000/j |
| `openai/gpt-oss-120b` | qualité supérieure | 30 | 1 000 | 8 000 | 200 000/j |
| `llama-3.1-8b-instant` | volume élevé | 30 | 14 400 | 6 000 | 500 000/j |

> ⚠️ `llama-3.3-70b-versatile` **déprécié le 2026-06-17** → ne pas utiliser.
> `openai/gpt-oss-20b` = défaut chat (bon rapport vitesse/qualité, 200K TPD).

### Traduction 15 langues — le point sensible
- **Groq (chat LLM)** possible mais bridé : TPD 200K (gpt-oss) ⇒ ~15 langues ×
  ~6K tokens ≈ **90K tokens/vidéo ⇒ ~2 vidéos/jour**. TPM 6-8K ⇒ **découper**
  (1 langue/requête, batch segments en JSON). Qualité ar/zh/ja/hi moyenne.
- **Alternative dédiée** (recherche Gemini séparée) : DeepL Free / Gemini Flash.
- Groq `llama-3.1-8b-instant` (500K TPD, 14.4K RPD) encaisse plus de volume mais
  qualité de traduction inférieure.

## Décisions
| # | Décision | Statut |
|---|---|---|
| D1 | Transcription → **Groq `whisper-large-v3-turbo`** (repli `-v3`). Sortie `verbose_json` (segments horodatés) → mapping drop-in. | acté |
| D2 | Résumé + chapitres → **Groq `openai/gpt-oss-20b`** via endpoint chat OpenAI-compatible. | acté |
| D3 | Mots-clés (KeyBERT) → **restent locaux** (réutilisent MiniLM). | acté |
| D4 | Embeddings/recherche (MiniLM) → **restent locaux**. | acté |
| D5 | Traduction → **par défaut Groq `gpt-oss-20b` (prompt, 1 langue/requête, batch JSON)** pour ne garder qu'1 clé ; **repli NLLB local conservé** si pas de clé/rate-limit. Choix définitif tranché après recherche Gemini. | à confirmer |
| D6 | Clé via `GROQ_API_KEY` (env/.env gitignoré). Timeout + retry (429) + repli local. | acté |
| D7 | Nettoyage deps : retirer `faster-whisper`, `ffmpeg-python` (si plus d'extraction locale), `llama-cpp-python`, `transformers`, `sentencepiece`, `sacremoses` **seulement si** NLLB abandonné (sinon garder en repli). Garder `sentence-transformers`, `keybert`. | acté |

## Risques
| Risque | Impact | Mitigation |
|---|---|---|
| Rate-limit 429 en démo live | pipeline bloqué en soutenance | repli local automatique + cache `outputs/` + pré-générer les vidéos de démo |
| TPD traduction (2 vidéos/j gpt-oss) | quota épuisé | limiter `TARGET_LANGS` en démo, ou langue à la demande, ou service dédié |
| Dépendance réseau (perte de l'atout offline) | argument soutenance affaibli | garder repli local activable (`ENGINE_BACKEND=local`) |
| Confidentialité (audio/texte envoyés à Groq) | données hors LAN | à assumer/documenter ; garder option 100 % local |
| Clé compromise (collée en chat) | usage frauduleux du quota | **révoquer + régénérer** avant tout |
| Whisper Groq : limite taille fichier (~25-40 Mo/requête) | gros fichiers rejetés | extraire/compresser l'audio (opus/mp3 16 kHz) avant upload, ou chunker |

## Plan d'Action (checklist)
### Phase 0 — Socle
- [ ] ❌ **Révoquer/régénérer la clé Groq** (exposée en chat) ; créer `engine/.env` depuis `.env.example`.
- [x] ✅ `config.py` : loader `.env`, providers (`ENGINE_ASR/LLM/TRANSLATE_PROVIDER`), clés Groq/OpenRouter, modèles, timeouts/retries, repli.
- [x] ✅ `.env.example` créé + `.env` ajouté au `.gitignore`.
- [x] ✅ Client HTTP unifié `app/nlp/remote.py` (chat Groq+OpenRouter, audio Groq, retry 429/5xx, timeout).

### Phase 1 — Transcription (D1)
- [x] ✅ `transcribe.py` : backend `groq` (MP3 16 kHz mono → `/audio/transcriptions` `verbose_json` → `segments[]`+`language`).
- [x] ✅ Repli local `faster-whisper` conservé (`ENGINE_ASR_PROVIDER=local` ou échec API).
- [ ] ❌ Vérif manuelle sur `tests/examples/*.mp4` avec vraie clé (à faire par l'utilisateur).

### Phase 2 — Résumé / chapitres (D2)
- [x] ✅ `summarize.py` : `_chat()` → `remote.chat` (Groq/OpenRouter) + repli local llama.cpp + dégradation gracieuse.
- [x] ✅ `extract_keywords` (MiniLM local) inchangé.

### Phase 3 — Traduction (D5)
- [x] ✅ `translate.py` : backend distant (chat LLM, chunké par budget de caractères, alignement segments conservé) + repli NLLB local.
- [ ] ❌ Décider défaut après recherche Gemini (Groq-seul vs service dédié) — provider surchargeable via `.env`.

### Phase 4 — Nettoyage & pipeline
- [x] ✅ `requirements.txt` : `httpx` en runtime ; modèles locaux marqués **repli optionnel**.
- [ ] ❌ `pipeline.py` : `models.unload_llm()` conservé (no-op en mode API) — à nettoyer si local abandonné.
- [ ] ❌ `Dockerfile` : alléger (option mode 100 % API, sans torch/llama-cpp).
- [ ] ❌ `model-selection.md` + `README` : documenter l'archi providers.

### Phase 5 — Validation
- [x] ✅ Vérifs offline : AST OK, imports OK, dispatch traduction testé (mock).
- [ ] ❌ `tests/` : mocker les appels distants (pas de réseau en CI).
- [ ] ❌ E2E manuel avec vraies clés (transcription + traduction + résumé) — **étape utilisateur**.
- [ ] ❌ Vérifier contrat P3-A (`docs/P3A-metadata-schema.md`) intact.

## Scénario contrainte — NAS à 90 % (upload + chiffrement AES)
Problématique : pendant l'upload d'une vidéo et son chiffrement (Pôle 2), le NAS
(Pentium 8505, 8 Go) est à **90 % d'utilisation** → quasi aucune marge CPU/RAM
pour l'IA locale.

| Modèle | Empreinte locale | Coexiste avec pic 90 % ? | Verdict |
|---|---|---|---|
| NLLB traduction | ~2,5 Go, CPU lourd ×15 langues | ❌ non | **externaliser** (Groq/Gemini/DeepL) |
| Qwen LLM (résumé/chapitres) | ~2,5 Go, génération CPU très lente | ❌ non | **→ Groq** |
| Whisper transcription | ~1,5 Go, CPU lourd | ❌ non | **→ Groq** |
| MiniLM embeddings/recherche | ~0,5 Go, courtes rafales | ⚠️ limite (garder) | **rester local** |
| KeyBERT mots-clés | réutilise MiniLM (0) | ⚠️ limite | **rester local** |

**Clé de résolution** : une fois les 3 lourds passés en API, la charge **locale**
de l'IA retombe à ≈ *I/O réseau + extraction/compression audio ffmpeg (courte)*
→ **négligeable**. Le pipeline peut alors tourner **en même temps** que le pic de
chiffrement à 90 %, ce qui serait impossible en 100 % local.

Recommandations complémentaires :
- Ne garder que **MiniLM + KeyBERT** en local ; tout le reste sur Groq.
- Si RAM trop juste même pour MiniLM à 90 % : soit **différer** l'indexation
  (file d'attente : lancer l'analyse quand le chiffrement est terminé), soit
  passer aussi les embeddings sur API (Gemini/Cohere) — mais choix actuel = garder.
- **+8 Go de RAM** sur le NAS (→ 16 Go) supprime la contrainte pour MiniLM.

## Avancement
- 2026-07-01 : plan créé. Limites Groq vérifiées. Décisions D1-D4, D6, D7 actées ; D5 en attente recherche Gemini. Scénario NAS 90 % ajouté.
- 2026-07-01 : **implémentation faite** (branche `feat/mobile-app`) — providers groq/openrouter/local, client `remote.py`, transcription+résumé+chapitres+traduction câblés avec repli local, `.env.example`, requirements/gitignore. Vérifs offline OK.
- 2026-07-01 : **ajout provider Gemini** (Google AI Studio, endpoint OpenAI-compatible). Les 3 étapes chat (LLM/traduction) acceptent groq|openrouter|gemini|local, choisies indépendamment ; correction : la traduction utilise bien `TRANSLATE_PROVIDER` (et non `LLM_PROVIDER`). Dispatch Gemini vérifié (mock). **Reste : créer `.env` (clés) + tests E2E manuels.**

## Résumé Non-Technique
On déporte les 2 traitements les plus lourds de l'analyse vidéo (la reconnaissance
de la parole et la génération du résumé) vers un service en ligne rapide et
gratuit (**Groq**), au lieu de les faire tourner péniblement sur la machine. La
recherche par mots-clés intelligente reste, elle, sur place (légère). La
traduction dans 15 langues est le seul point à finaliser car le service gratuit
limite le volume quotidien. Bénéfice : analyses beaucoup plus rapides. Contrepartie :
il faut une connexion internet et respecter des quotas — on garde donc une
solution de secours qui refonctionne sans réseau. Point d'attention immédiat :
la clé d'accès a été exposée et doit être régénérée.
