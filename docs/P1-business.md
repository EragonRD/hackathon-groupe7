# P1 — Lecture business (Poulpium, revue vidéo collaborative)

> Livrable D du `todo/PLAN-AMOS.md`. ~1 page. Sources : produit réel (`frontend/`),
> `docs/ETAT-PROJET.md`, `frontend/REFONTE-UI.md`. Les chiffres sont signalés comme
> **hypothèses à valider** : rien n'est mesuré, on ne prétend pas le contraire.

## Le problème

Aujourd'hui, les retours sur une vidéo (montage, formation, présentation) circulent
par **e-mail, messagerie ou tableur** : « à 1:32 le logo est trop petit », « vers la
fin le son sature ». C'est :
- **imprécis** : l'instant exact est décrit à la main, souvent mal ;
- **fastidieux** : aller-retour, on recolle les commentaires au montage à la main ;
- **non traçable** : pas de fil, pas de statut « traité / à revoir », rien de réutilisable.

## La solution

**Poulpium** rattache chaque retour à **l'instant exact** de la vidéo (timecode) et
le rend **visuel** (on dessine sur l'image : flèche, cadre, ellipse, texte, trait libre)
et **collaboratif en direct** (plusieurs relecteurs sur la même session, curseurs et
commentaires synchronisés). Le tout s'**exporte en JSON réutilisable** (archivage,
reprise, autre outil).

Valeur en une phrase : **transformer un fil d'e-mails imprécis en une revue précise,
partagée et réexploitable.**

## Ce qui rend la proposition crédible (déjà livré)

- Retour **ancré au timecode** + annotation visuelle (coordonnées normalisées, fidèles
  à toute taille d'écran).
- **Temps réel** multi-participants (multi-fenêtres, et LAN multi-machines via socket.io).
- **Watch Together** : un présentateur pilote la lecture, les invités suivent.
- **Export / import JSON** : la revue est un livrable, pas un échange volatil.
- **Zero-Trust** (Pôle 2) : vidéo chiffrée, clé servie sous identité, watermark de
  traçabilité, tableau de bord de surveillance. Argument fort pour des contenus sensibles.
- **IA** (Pôle 3) : transcription, chapitres, mots-clés, recherche sémantique,
  sous-titres multilingues, pour retrouver un passage sans tout revisionner.

## Pour qui

| Cible | Usage |
|---|---|
| Équipes **montage / post-production** | Retours cadrés à l'image, validés à plusieurs |
| **Formation / e-learning** | Annoter des rushes de cours, chapitrer, sous-titrer |
| **Communication / présentations internes** | Relire une vidéo corporate avant diffusion |
| Contenus **sensibles / confidentiels** | Diffusion Zero-Trust auto-hébergeable (pas de cloud tiers) |

## Bénéfices attendus (hypothèses à valider par un test terrain)

- **Moins d'allers-retours** : le retour est au bon endroit du premier coup.
- **Moins d'ambiguïté** : le dessin + le timecode remplacent la description écrite.
- **Réutilisation** : l'export sert d'historique et de check-list de corrections.
- Gain de temps par cycle de revue : **à mesurer** (ne pas annoncer de pourcentage sans test).

## Positionnement

Comparable dans l'esprit aux outils pro de revue vidéo (type Frame.io), mais avec un
**argument différenciant clair pour la soutenance** : **100 % local / auto-hébergeable**,
avec une **couche sécurité Zero-Trust** et une **IA locale** (aucune clé API payante,
aucun service cloud). C'est le bon compromis pour un contexte où la donnée ne doit pas
sortir.

## Ce qu'on conseillerait à un créateur de contenu

1. Ouvrir une session par vidéo à relire, inviter les relecteurs (lien invité).
2. Commenter **au timecode** plutôt que par e-mail ; dessiner pour lever l'ambiguïté.
3. **Exporter** la revue en fin de cycle : elle devient la to-do de corrections.
4. Pour des contenus sensibles, tirer parti du flux chiffré et du watermark.
