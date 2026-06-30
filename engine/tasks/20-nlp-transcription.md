# Tâche 20 — Transcription audio horodatée · Responsable : Duval

## Objectif
De la vidéo au transcript : extraire l'audio, transcrire avec Whisper, produire des **segments horodatés** et détecter la langue.

## Entrées / Sorties
| Entrées | Sorties (champs du JSON contrat) |
|---|---|
| Fichier vidéo | `language`, `transcript` (texte complet), `segments[]` (`start`, `end`, `text`) |

## Dépendances
- Bloquée par : 00 (socle).
- Alimente : 21 (résumé/mots-clés), 22 (embeddings), 10 (API).

## Étapes (checklist)
- [ ] ❌ Extraction audio via ffmpeg (`ffmpeg-python`) → WAV 16 kHz mono
- [ ] ❌ Charger **faster-whisper** (modèle `base`/`small`, `device=cpu`, `compute_type=int8`)
- [ ] ❌ Transcrire avec timestamps par segment
- [ ] ❌ Détection automatique de la langue
- [ ] ❌ Normaliser la sortie au format `segments[]` du contrat P3A
- [ ] ❌ Module `app/nlp/transcribe.py` : fonction `transcribe(video_path) -> dict`
- [ ] ❌ Test sur la vidéo `media/`

## Critères « fait »
- `segments[]` non vides, horodatés, cohérents avec l'audio.
- `language` détectée correctement.
- Temps de traitement raisonnable sur CPU (modèle léger).

## Notes / pièges
- `tiny` si trop lent, `small` si qualité insuffisante — arbitrer.
- Audio mono 16 kHz obligatoire pour Whisper.
- Conserver `segments` bruts (réutilisés par 21 et 22).
