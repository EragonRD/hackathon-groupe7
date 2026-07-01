# P1 — Matrice de test avant soutenance

> Livrable G du `todo/PLAN-AMOS.md`. Cas dérivés des fonctionnalités réellement
> présentes dans le code (`frontend/src/`). À faire passer avant la démo ; noter les
> écarts pour Alex/Matthieu. Chaque ligne = un cas + résultat attendu + case à cocher.

## Comment tester
- `cd frontend && npm install && npm run dev`.
- Vidéo : déposer un `.mp4` dans `frontend/public/sample.mp4` (ignoré par git) **ou**
  « Charger une vidéo locale » dans le catalogue.
- Collaboration mono-machine : ouvrir **2-3 fenêtres** du même navigateur sur la même
  session (mode `broadcast` par défaut).
- Collaboration LAN (optionnel) : `VITE_COLLAB_MODE=socket` + `VITE_API_URL=http://<ip>:3000`,
  backend lancé (`cd backend && npm run start:dev`).

## 1. Annotation
| # | Cas | Attendu | ☐ |
|---|---|---|---|
| 1.1 | Trait libre (`pen`) | Se dessine, suit la souris, part dans la note | ☐ |
| 1.2 | Flèche (`arrow`) | Pointe correcte de `from` vers `to` | ☐ |
| 1.3 | Cadre (`rect`) | Rectangle entre coins opposés | ☐ |
| 1.4 | Ellipse (`ellipse`) | Ellipse dans la boîte englobante | ☐ |
| 1.5 | Texte (`text`) | Saisie posée au bon endroit **à toute taille de fenêtre** | ☐ |
| 1.6 | Gomme / clear | Retire les formes visées ; diffusé (`note:update`) | ☐ |
| 1.7 | 6 couleurs | Chaque couleur s'applique et s'exporte | ☐ |

## 2. Commentaires
| # | Cas | Attendu | ☐ |
|---|---|---|---|
| 2.1 | Ajouter un commentaire au timecode | Apparaît dans la liste, triée par temps | ☐ |
| 2.2 | Saut à l'instant | Clic sur une note → la vidéo se cale sur `note.time` | ☐ |
| 2.3 | Éditer une note | Rouvre, modifie, enregistre → **même id** (pas de doublon) | ☐ |
| 2.4 | Répondre (fil) | Réponse ajoutée sous la note | ☐ |
| 2.5 | Résolu / non résolu | Toggle change l'état, propagé | ☐ |
| 2.6 | Supprimer (auteur ou admin) | Note retirée partout | ☐ |
| 2.7 | Filtres (auteur / état / mes commentaires) | La liste se restreint correctement | ☐ |
| 2.8 | Compositeur `Ctrl/⌘+↵` | Envoie la note | ☐ |

## 3. Temps réel (2-3 fenêtres, même session)
| # | Cas | Attendu | ☐ |
|---|---|---|---|
| 3.1 | 3 fenêtres synchronisées | Une note créée dans l'une apparaît dans les autres | ☐ |
| 3.2 | Suppression propagée | La suppression se répercute partout | ☐ |
| 3.3 | Curseurs distants | Les curseurs nommés/colorés des autres sont visibles | ☐ |
| 3.4 | Retardataire | Une fenêtre ouverte **après** reçoit l'état courant (`sync:state`) | ☐ |
| 3.5 | Présence | Un pair qui ferme disparaît (≤ 9 s) | ☐ |

## 4. Watch Together
| # | Cas | Attendu | ☐ |
|---|---|---|---|
| 4.1 | Prendre la présentation | `wt:claim` → l'émetteur devient présentateur unique | ☐ |
| 4.2 | Play/pause/seek | Se répercute chez les invités (contrôles verrouillés) | ☐ |
| 4.3 | Retardataire resynchronisé | Rejoint et se cale sur la lecture du présentateur | ☐ |
| 4.4 | Sélection de note diffusée | Les invités affichent la même note active (mêmes dessins) | ☐ |
| 4.5 | Départ du présentateur | La main se libère (plus personne ne pilote) | ☐ |

## 5. Export / Import
| # | Cas | Attendu | ☐ |
|---|---|---|---|
| 5.1 | Export | Télécharge `revue-<session>.json` (enveloppe `{version,session,exportedAt,notes}`) | ☐ |
| 5.2 | Round-trip | Réimport dans une fenêtre neuve → notes + dessins fidèles | ☐ |
| 5.3 | Import tableau nu | Un fichier `[ … ]` (notes seules) est accepté | ☐ |
| 5.4 | Import invalide | Fichier hors format → message « Import impossible » (pas de crash) | ☐ |

## 6. États & robustesse
| # | Cas | Attendu | ☐ |
|---|---|---|---|
| 6.1 | Chargement vidéo | Squelette tant que `loadedmetadata` n'a pas fired | ☐ |
| 6.2 | Source illisible | Event `error` du `<video>` → message clair | ☐ |
| 6.3 | Aucune vidéo | Catalogue affiche un état vide explicite | ☐ |
| 6.4 | Rechargement (F5) | Réhydratation de l'auth (token valide) sans re-login | ☐ |
| 6.5 | Navigation clavier | `←/→` = ±5 s, `Shift+←/→` = marqueurs, `Home/End` = début/fin | ☐ |

## 7. Multi-machines (si mode `socket`)
| # | Cas | Attendu | ☐ |
|---|---|---|---|
| 7.1 | 2 machines, même session | Notes et curseurs traversent le LAN via la gateway | ☐ |
| 7.2 | Reconnexion socket | Après coupure réseau, la room est rejointe et l'état resynchronisé | ☐ |

> Notes de test à consigner ici (bug → responsable) au fil des passages.
