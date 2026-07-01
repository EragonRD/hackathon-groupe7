# Corpus de vidéos de test — Engine P3-A

Vidéos d'exemple **versionnées** comme corpus de test du pipeline (transcription → sous-titres multilingues). Couvrent plusieurs langues sources.

| Fichier | Langue source | Durée | Contenu | Sert à tester |
|---|---|---|---|---|
| `speech1.mp4` | en | ~9,6 min | discours de remise de diplôme | EN long, charge, 4+ langues |
| `cours-anglais.mp4` | **fr** | ~3,9 min | cours de prononciation française | détection de langue (≠ nom de fichier) |
| `test-espagnol.mp4` | es | ~? | contenu espagnol | source ES → traductions |

## Lancer un test
```bash
cd engine && source .venv/bin/activate
.venv/bin/python scripts/analyze_file.py "tests/examples/speech1.mp4"
# → engine/outputs/speech1/ (vidéo + JSON par langue)
```

> Si un binaire est absent (clone frais), les tests qui en dépendent sont **skippés** (`pytest.mark.skipif`).
> Récupère/dépose simplement le `.mp4` ici pour réactiver le test.
