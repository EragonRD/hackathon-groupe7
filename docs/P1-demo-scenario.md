# P1 — Scénario de démonstration (multi-fenêtres)

> Livrable A du `todo/PLAN-AMOS.md`. Script pas-à-pas pour la soutenance. Vise 3-4 min.
> Comptes de démo : `alice` (admin), `bob`, `carol` — mot de passe `password`.

## Préparation (avant de monter sur scène)
- Backend lancé (`cd backend && npm run start:dev`) si on montre l'auth réelle.
- `frontend/public/sample.mp4` déposé, ou vidéo locale prête à charger.
- **Deux à trois fenêtres** du navigateur, côte à côte, sur la même session.
  - Mono-machine (défaut, `broadcast`) : suffit pour la démo, 100 % offline.
  - Multi-machines (`VITE_COLLAB_MODE=socket` + `VITE_API_URL=http://<ip>:3000`) :
    seulement si le réseau est fiable. Sinon rester en mono-machine.
- Se connecter : fenêtre 1 = `alice`, fenêtre 2 = `bob`, (fenêtre 3 = `carol`).

## Déroulé (≈ 3-4 min)

1. **Le problème (20 s, sans écran).** « Aujourd'hui les retours sur une vidéo se font
   par e-mail : *à 1:32 le logo est trop petit*. Imprécis, lent, on perd l'instant exact. »

2. **Ouvrir la revue (20 s).** Fenêtre 1 (`alice`) : ouvrir la vidéo, montrer la timeline
   et la barre d'outils. Fenêtre 2 (`bob`) : même session, à côté.

3. **Annoter à l'instant (40 s).** `alice` met en pause à un instant précis, dessine une
   **flèche** + tape un **texte** sur l'image, écrit un commentaire, valide.
   → **Moment clé** : la note et les dessins apparaissent **en direct** chez `bob`.

4. **Collaborer (30 s).** `bob` **répond** dans le fil, marque un autre point avec une
   **ellipse**, `alice` voit tout arriver. Montrer les **curseurs distants** nommés.

5. **Naviguer (20 s).** Cliquer une note → la vidéo **saute au timecode**. Montrer la
   navigation clavier (`←/→` = ±5 s, `Shift+←/→` = de marqueur en marqueur).

6. **Watch Together (30 s, optionnel).** `alice` **prend la présentation** : elle
   play/pause/seek, `bob` **suit** (contrôles verrouillés) et voit la **même note active**.

7. **Résoudre & filtrer (20 s).** Marquer une note **résolue**, filtrer « ouvertes » /
   « mes commentaires ». Supprimer une note → disparaît partout.

8. **Export / Import (30 s).** `alice` **exporte** la revue (`revue-<session>.json`).
   Ouvrir une **fenêtre neuve**, **réimporter** → notes + dessins reviennent à l'identique.
   → **Moment clé** : « la revue est un livrable réutilisable, pas un fil d'e-mails. »

9. **Clôture (15 s).** Une phrase sur l'architecture (View / Core / Engine, auth partagée)
   et le Bloc B (couture P2 flux chiffré + P3 transcription/hotspots).

## Le « moment whaou » à soigner
La **synchronisation en direct** (étape 3) et le **round-trip export → réimport** (étape 8).
Ce sont les deux instants qui rendent la valeur évidente sans explication.

## Notes d'honnêteté (à assumer si on demande)
- Mono-machine (`broadcast`) : la synchro est **multi-fenêtres d'un seul navigateur**.
- LAN multi-machines (`socket`) : **implémenté** (gateway `ReviewGateway`, room `session`),
  activable par variable d'env. Ne le démontrer que si le réseau est fiable le jour J.
- Vidéo locale : `sample.mp4` est propre à chaque poste (ignoré par git).
