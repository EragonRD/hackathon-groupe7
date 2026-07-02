# 🎤 Speech de soutenance — Poulpium (Groupe 7)

Deck : `Poulpium-Soutenance.html` (**23 slides**). Prod live : **https://poulpium.midjix-lab.com** (comptes `alice`/`bob`/`carol`, mdp `password`).

**Format : ~20 min = ~15 min de speech (mot à mot ci-dessous) + ~5 min de démo live à la fin.**

> **Débit oral :** à l'oral on parle à **~130–140 mots/min**. Parlez posément, respirez aux points. Chaque intervenant enchaîne sur le suivant (phrases de passage en gras à la fin de chaque partie).

## Ordre & slides

| # | Intervenant | Partie | Slides | Durée |
|---|---|---|---|---|
| 1 | **Enzo** | Ouverture (projet + équipe) | 1–2 | ~1 min |
| 2 | **Alex** | Pôle 1 — View / revue collaborative | 3–7 | ~3 min |
| 3 | **Enzo** | Pôle 2 — Core / sécurité Zero-Trust | 8–11 | ~3 min |
| 4 | **Gabriel** | Pôle 2 — Audit & scans de sécurité | 12–13 | ~1,5 min |
| 5 | **Rabah** | Pôle 3-A — IA / NLP | 14–17 | ~2,5 min |
| 6 | **Izlene** | Pôle 3-B — Data / rétention | 18–20 | ~2 min |
| 7 | **Enzo** | Les bonus (tous pôles + mobile) | 21 | ~1 min |
| 8 | **William** | Déploiement / production | 22 | ~1,5 min |
| 9 | **Tous** | 🔴 Démo live | 23 → prod | ~5 min |

---

# 📝 Le speech (mot à mot)

## 🔵 ENZO — Ouverture · slides 1–2 *(~1 min)*

**[Slide 1 — page de garde projet]**
« Bonjour à tous. Aujourd'hui, donner un retour sur une vidéo, c'est souvent un e-mail illisible : *« à une minute trente, le logo en haut est trop petit… enfin je crois »*. Imprécis, fastidieux, source de malentendus. On vous présente **Poulpium**, une plateforme de revue vidéo collaborative qui règle ça. Notre parti pris dès le départ : ne pas livrer trois projets côte à côte, mais **une seule application cohérente** — *une plateforme vidéo, trois pôles, une seule identité* — déployée en production, pas sur un localhost. »

**[Slide 2 — l'équipe]**
« On est le **Groupe 7 : 15 personnes réparties sur 3 pôles**. Moi c'est Enzo, chef de projet, je porte aussi le pôle Core. Alex mène le pôle View, Rabah et Izlene le pôle Engine, William s'occupe de la production, et Gabriel de l'audit sécurité. Chacun va vous présenter sa partie. On commence par ce que voit l'utilisateur — **Alex**. »

---

## 🔵 ALEX — Pôle 1 · View / revue · slides 3–7 *(~3 min)*

**[Slide 3 — page de garde P1]**
« Merci Enzo. Le pôle View, c'est l'application de **revue vidéo collaborative** — annoter, commenter, à la seconde près, à plusieurs et en direct. Notre sujet imposait un **lecteur de revue augmenté**, et un second volet : le visionnage synchronisé. »

**[Slide 4 — le produit]**
« Tout se passe sur **un seul écran** : le lecteur, une timeline avec des marqueurs de commentaires, un calque de dessin par-dessus l'image, et à droite le fil de commentaires. Pas de va-et-vient entre outils : on regarde, on annote, on discute, au même endroit. Côté design, on a assumé un parti pris **studio sombre**, façon outils pro, un seul accent visuel — pour que l'attention reste sur l'image. »

**[Slide 5 — annoter]**
« Concrètement : on met en pause, on dessine — **flèche, cadre, ellipse, texte, trait libre**, six couleurs — et on rattache un commentaire à cet instant précis. Détail important : les dessins sont en **coordonnées normalisées**, de zéro à un. Résultat, une flèche posée sur mon écran tombe **exactement au même endroit** sur le vôtre, quelle que soit la taille de la fenêtre. Et un clic sur un marqueur ramène **tout le monde à la bonne seconde**. »

**[Slide 6 — commentaires en temps réel]**
« Le fil est **vivant** : commentaires triés par instant, **réponses, résolution, likes, filtres**. Grâce à la couche temps réel, on voit la **présence** des autres, leurs **curseurs distants nommés**, et les notes se propagent instantanément. Le point d'architecture qu'on aime bien : le transport temps réel est **abstrait** — la même interface marche en multi-fenêtres hors-ligne, ou en réseau local via socket.io — sans changer une ligne de l'application. Et tout persiste côté serveur : une revue reprend là où on l'a laissée. »

**[Slide 7 — Watch Together]**
« Deuxième sujet livré : le **Watch Together**. Un participant *prend la présentation* : ses play, pause et déplacements se répercutent chez les invités, dont les contrôles sont verrouillés. Un retardataire est **resynchronisé automatiquement**, et la dérive est recalée. Regarder, mais **ensemble**. Cette vidéo est protégée par le Core — **Enzo**. »

---

## 🔴 ENZO — Pôle 2 · Core / sécurité · slides 8–11 *(~3 min)*

**[Slide 8 — page de garde P2]**
« Merci Alex. Le Core, c'est le **back-end qui ne fait confiance à personne** : Zero-Trust. Deux sujets livrés — **chiffrer la diffusion** pour qu'on ne puisse pas piller les vidéos, et **détecter les abus** en temps réel. »

**[Slide 9 — architecture]**
« Le Core est **la seule porte** : c'est lui qui décide qui voit quoi, qui reçoit quelle clé, qui a le droit d'analyser. La View demande, l'Engine est appelé par service — et tout passe par **un seul jeton JWT**, la même identité pour les trois pôles. »

**[Slide 10 — le serveur de clés]**
« Premier sujet : la vidéo n'est **pas** un fichier téléchargeable, c'est un **flux HLS chiffré en AES-128**, et la clé n'est délivrée qu'à un utilisateur authentifié. Le cœur, c'est ce **serveur de clés éphémères** : à chaque demande, on re-vérifie tout de zéro — jeton, entreprise, droits, révocation. **Refus par défaut**. La preuve : avec un jeton valide la vidéo se lit ; sans jeton, 401 ; mauvaise entreprise, 404, on ne révèle rien ; clé **révoquée en direct**, 403. Et chaque accès est **journalisé**. »

**[Slide 11 — blocage réel]**
« Deuxième sujet : **détecter et bloquer l'aspiration** — le scraping des segments. Une lecture normale demande un segment toutes les quelques secondes ; une aspiration les demande tous, très vite. On surveille donc le **débit par acteur** : au-delà de 8 segments par minute, une alerte ; au-delà de 20, on **bloque**. Et le blocage est **réel** : nginx interroge le Core **avant** chaque segment ; au-delà du seuil, 403, et nginx refuse le segment. On l'a démontré avec de vrais **scripts d'attaque** — l'aspiration passe d'abord, puis se fait couper net. On ajoute un rate-limit global, la détection des comptes partagés et des IP proxy. Et on a même **audité** notre propre code — **Gabriel**. »

---

## 🩵 GABRIEL — Pôle 2 · Audit & scans · slides 12–13 *(~1,5 min)*

**[Slide 12 — scan grype]**
« Merci Enzo. On n'a pas voulu juste *dire* que c'est sécurisé, on l'a **vérifié**. Premier scan, les **dépendances**, avec **grype** : 160 paquets analysés. On a trouvé deux vulnérabilités sur la librairie *multer* — un déni de service — qu'on a **corrigées** en montant en version 2.2.0, sans rien casser. »

**[Slide 13 — rapport Trivy]**
« Deuxième scan, les **images Docker**, avec **Trivy**. Le front et le nginx sont à **zéro vulnérabilité** ; le Core, on a patché la couche système ; et l'image de l'Engine est **surveillée**, même si elle est hors de notre périmètre. Une vraie démarche sécurité, du code jusqu'à l'image livrée. Passons à l'intelligence — **Rabah**. »

---

## 🩵 RABAH — Pôle 3-A · IA / NLP · slides 14–17 *(~2,5 min)*

**[Slide 14 — page de garde P3]**
« Merci Gabriel. Pour une machine, une vidéo, c'est une **boîte noire** : impossible de retrouver *“le passage où on parle de sécurité”* sans tout revisionner. Notre pôle rend ce contenu **exploitable**. »

**[Slide 15 — le pipeline]**
« Le pipeline, en une passe. En entrée une vidéo : on extrait l'audio avec **ffmpeg**, on le transcrit avec **Whisper** — texte horodaté à la seconde. Puis, pour le résumé et les chapitres, un modèle **Qwen 2.5** quantifié, exécuté via **llama.cpp** — donc du **Llama** local, in-process, sans clé d'API. Enfin **NLLB-200** traduit. Tout est **asynchrone** : l'API renvoie un identifiant de job, le Core n'est jamais bloqué. Et tout tourne **en local, sur CPU, sans aucune clé payante**. »

**[Slide 16 — un JSON riche]**
« En sortie, pas juste une transcription : un **JSON riche** — segments horodatés, résumé, chapitres, mots-clés, traductions. Un contrat propre que le front consomme directement. »

**[Slide 17 — recherche & sous-titres]**
« Et comme tout est horodaté, on rend la vidéo **trouvable** : **recherche sémantique** — on tape une idée, l'appli saute au bon instant — et **sous-titres multilingues** incrustés dans le lecteur. Comprendre le contenu, c'est une chose ; comprendre l'**audience**, c'en est une autre — **Izlene**. »

---

## 💜 IZLENE — Pôle 3-B · Data / rétention · slides 18–20 *(~2 min)*

**[Slide 18 — où l'attention décroche]**
« Merci Rabah. Moi je pars des **logs de visionnage** : chaque play, pause, retour en arrière. Bien analysés, ils disent **où** une vidéo perd son audience, et **lesquelles** retiennent le mieux. On combine quatre signaux de friction — les retours en arrière, la chute de rétention, les abandons, et les pauses — et on en extrait les **zones anormales**. Pour un créateur, c'est de l'or : ça pointe exactement les passages à retravailler. »

**[Slide 19 — prédire, sans tricher]**
« On va plus loin : **prédire** la rétention sur une vidéo qu'on n'a jamais vue. Le point sur lequel on insiste, c'est l'**honnêteté méthodologique** : les données corrigées à la main — la vérité terrain — servent **uniquement à l'évaluation**, jamais comme variable d'entraînement. C'est une règle qu'on s'est fixée pour éviter la **fuite de cible**, le piège qui fait qu'un modèle a l'air parfait en test et s'effondre en vrai. »

**[Slide 20 — les chiffres]**
« Et on **mesure** contre un corrigé humain : un **F1 de 0,77**, avec une précision de 0,69 et un rappel de 0,86. Des chiffres, et le code derrière. Voilà pour les trois pôles — mais on a aussi ajouté beaucoup **en plus**. Enzo. »

---

## ⭐ ENZO — Les bonus · slide 21 *(~1 min)*

**[Slide 21 — au-delà du cahier des charges]**
« Au-delà du strict cahier des charges, on a construit une vraie plateforme. Côté **View** : un back-office, l'upload de vidéos, les invités par lien. Côté **Core** : le **multi-tenant** à trois niveaux, l'onboarding par e-mail, l'orchestration de l'Engine, le Capture Guard, et les scans que Gabriel vient de montrer. Côté **Engine** : l'analyse de rétention et les traductions. Et surtout, une **application mobile React Native complète** — Insights IA, commentaires, Watch Together, administration. Tout ça, c'est bien beau — mais est-ce que ça tourne vraiment ? **William**. »

---

## 🟢 WILLIAM — Déploiement / prod · slide 22 *(~1,5 min)*

**[Slide 22 — en prod, en une commande]**
« Merci Enzo. Oui, ça tourne **en prod, pour de vrai**, et ça tient en **une commande**. Quatre points. Un : c'est **accessible partout**, et pourtant **aucun port n'est ouvert** sur le serveur — on passe par un **Cloudflare Tunnel**, le serveur n'expose rien. Deux : `docker compose up`, et **quatre conteneurs** se lèvent — front, Core, HLS, Engine — avec des images tirées de **GHCR**, aucun build sur le serveur, zéro cloud payant. Trois : la **livraison continue** — on pousse le code, l'image se reconstruit, et **Watchtower** met à jour les conteneurs tout seul. Quatre : c'est **léger** — quelques centaines de méga de RAM, CPU quasi nul au repos — exposé proprement, et **déjà visité**. Une plateforme vidéo complète, en ligne. Et le mieux, c'est de vous la montrer. »

---

## 🔴 TOUS — Démo live · slide 23 → **poulpium.midjix-lab.com** *(~5 min)*

**[Slide 23 — à vous de jouer]**
« Place à la démo. On se connecte sur **poulpium.midjix-lab.com** avec le compte **alice**, et on suit le fil : **une identité, un flux, trois pôles**. »

### Déroulé de la démo (à faire en direct)

1. **Login** (`alice` / `password`) → on arrive sur le catalogue. *(P2 : auth)*
2. **Ouvrir une vidéo** → elle se lit : c'est un **flux HLS chiffré**, la clé a été demandée au Core avec le jeton. *(P2-A : Zero-Trust)*
3. **Annoter** : pause, on dessine une flèche, on écrit un commentaire au timecode → il apparaît dans le fil. *(P1)*
4. **Temps réel** : ouvrir une 2ᵉ fenêtre (ou un binôme) → le commentaire et le curseur apparaissent en direct ; activer **Watch Together**. *(P1)*
5. **Insights IA** : ouvrir le panneau sous le lecteur → résumé, chapitres cliquables, **recherche** dans la transcription, **sous-titres** multilingues. *(P3-A)*
6. **Sécurité en direct** : dans l'admin, **révoquer la clé** d'un contenu → la lecture passe à 403 ; montrer le **dashboard de surveillance** (anti-scraping). *(P2)*
7. **(si le temps le permet)** l'**app mobile** sur téléphone. *(bonus)*

> **Filet de sécurité démo :** si le réseau lâche, basculer sur une capture / la vidéo `sample.mp4` en local. Garder une fenêtre déjà connectée en secours.

**[Clôture]**
« Voilà Poulpium : revue, sécurité et IA ne sont pas juxtaposées — elles partagent **une identité, un flux**, et tournent **en production**. Merci pour votre attention, on répond à vos questions. »
