# 📐 Jeu de données — Analyse d'audience (Pôle 3-B)

Jeu de données **synthétique, déterministe et 100 % local**, fourni dans `data/`.

## `viewing_logs.csv` — logs d'évènements

| Colonne | Type | Description |
|---|---|---|
| `event_id` | int | identifiant de l'évènement |
| `session_id` | str | une session = un visionnage (un user × une vidéo) |
| `user_id` | str | identifiant utilisateur (`u0001`…) |
| `video_id` | str | identifiant vidéo (`v01`…) |
| `video_duration_sec` | int | durée totale de la vidéo |
| `event_type` | str | `play`, `pause`, `seek_back`, `heartbeat`, `ended`, `abandon` |
| `position_sec` | int | position dans la vidéo au moment de l'évènement |
| `event_time` | str | horodatage ISO 8601 (temps réel) |

## `videos.csv` — catalogue

| Colonne | Description |
|---|---|
| `video_id`, `title`, `category`, `duration_sec` | métadonnées des vidéos |

## `ground_truth_hotspots.csv` — vérité terrain ⚠️

Les **zones d'ennui** (`video_id`, `hotspot_start`, `hotspot_end`).
👉 Sert **uniquement à VALIDER** votre détection (mesurer précision / rappel).
**Ne pas** l'utiliser comme feature d'entraînement, ni comme source de la
détection : ce serait de la triche.

## La cible à prédire : la « rétention »

La **cible**, c'est ce que votre modèle doit deviner : le **taux de rétention** d'une
vidéo = en moyenne, **quelle fraction de la vidéo les gens regardent**.

**Calcul :** pour chaque session, `position_max_atteinte / durée_vidéo` ; la rétention
de la vidéo est la **moyenne** de cette fraction sur toutes ses sessions (entre 0 et 1).
*Exemple : une vidéo de 200 s où les gens s'arrêtent en moyenne à 150 s → rétention =
0,75.*

### ⚠️ La règle d'or : ne donnez pas la réponse en entrée du modèle

Prédire, c'est **deviner la rétention sans la connaître à l'avance**. Le piège (appelé
« fuite de cible ») : donner au modèle une information qui **contient déjà la réponse**.

> 🎓 **Analogie.** C'est comme prédire la note d'un élève à un examen. Si vous donnez
> au modèle… sa note (ou son nombre de bonnes réponses), il ne « prédit » rien : il
> **recopie**. Il faut deviner à partir d'indices connus **avant** le résultat.

**❌ Interdit en entrée du modèle** (ce serait recopier la réponse) :
- la rétention elle-même ;
- toute variable qui n'en est qu'une reformulation : « position moyenne atteinte »,
  « % de gens qui vont jusqu'au bout », « durée réellement regardée »… ;
- le fichier `ground_truth_hotspots.csv` (le corrigé).

**✅ Autorisé** (des indices disponibles *avant* de connaître le résultat) :
- **caractéristiques de la vidéo** : `category`, `duration_sec` ;
- **comportement de début** (« engagement précoce ») : p. ex. le % de spectateurs
  encore présents après les 10 premiers % de la vidéo ;
- **signes de difficulté** : nombre de `pause`, de retours en arrière (`seek_back`),
  endroits où beaucoup de gens ralentissent.

> En une phrase : **`ground_truth_hotspots.csv` et la rétention servent à VÉRIFIER votre
> travail, jamais à le NOURRIR.**
