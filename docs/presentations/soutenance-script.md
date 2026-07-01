# 🎤 Speech de soutenance — Poulpium (Groupe 7)

Deck : `Poulpium-Soutenance.html` (22 slides). Prod live : **https://poulpium.midjix-lab.com** (comptes `alice`/`bob`/`carol`, mdp `password`).

**Format : 20 min = ~15 min de speech (mot à mot ci-dessous) + ~5 min de démo live à la fin.**

> **Débit oral :** pas 35 mots/min — à l'oral on parle à **~130–150 mots/min**. Ce script fait **~2000 mots ≈ 15 min** (≈ 350 mots / intervenant). Parlez posément, respirez aux points.

## Ordre & slides

| Intervenant | Rôle | Slides |
|---|---|---|
| **Enzo** | Ouverture (intro + archi) | 1–2 |
| **Rabah** | Pôle 3-A — IA / NLP | 3–6 |
| **Izlen** | Pôle 3-B — Data / rétention | 7–10 |
| **Enzo** | Pôle 2 — Sécurité | 11–14 |
| **Alex** | Pôle 1 — Front / revue | 15–17 |
| **William** | Prod + Bloc B | 18–22 |
| **Tous** | 🔴 Démo live | prod |

On finit sur le front puis la prod → on enchaîne la **démo live** (le front, en vrai).

---

# 📝 Le speech (mot à mot)

## 🔵 ENZO — Ouverture · slides 1–2 *(~1 min)*

**[Slide 1 — cover]**
« Bonjour à tous. On vous présente **Poulpium**, une plateforme de revue vidéo. Notre parti pris dès le départ : ne pas livrer trois projets côte à côte, mais **une seule application cohérente**, où trois pôles s'imbriquent — la collaboration, la sécurité, et l'intelligence artificielle. »

**[Slide 2 — architecture]**
« Techniquement, ça tient en trois briques : la **View**, notre front en React ; le **Core**, notre back en NestJS ; et l'**Engine**, notre service d'IA en Python. Le point à retenir, c'est celui-là : **une seule identité, un seul jeton, traverse les trois**. C'est ce fil rouge qui fait qu'on a une plateforme, et pas trois outils juxtaposés. On commence par le cœur intelligent — Rabah. »

---

## 🩵 RABAH — Pôle 3-A · IA / NLP · slides 3–6 *(~3 min)*

**[Slide 3 — divider]**
« Merci Enzo. Pour une machine, une vidéo, c'est une **boîte noire** : impossible de retrouver “le passage où on parle de sécurité” sans tout revisionner. Notre pôle rend ce contenu **exploitable**. »

**[Slide 4 — pipeline]**
« Voici le pipeline. En entrée, une vidéo. On extrait l'audio avec **ffmpeg**, on le transcrit avec **Whisper** : on obtient le texte, **horodaté à la seconde**, avec la langue détectée. Ensuite un modèle de langage local, **Qwen 2.5** via llama.cpp, produit un **résumé** et découpe la vidéo en **chapitres**. Enfin **NLLB-200** traduit, pour des **sous-titres multilingues**. En sortie, un JSON riche. Tout est **asynchrone** — l'API renvoie un identifiant de job, donc le Core n'est jamais bloqué — et tout tourne **en local, sur CPU, sans aucune clé d'API payante**. »

**[Slide 5 — JSON]**
« Le résultat, ce n'est pas qu'une transcription : on a les segments horodatés, un résumé, des chapitres cliquables, des mots-clés, et les traductions. Et comme chaque segment est horodaté, on fait de la **recherche sémantique** : on tape “où on parle de sécurité”, et l'application **saute directement au bon instant**. »

**[Slide 6 — modèles]**
« Un mot sur nos choix : des modèles **délibérément légers**, pour tenir sur un laptop — Whisper base, Qwen 1,5 milliard quantifié, MiniLM pour la recherche, NLLB pour la traduction. Le tout exposé par une API **FastAPI**, sécurisée par le jeton du Core. Comprendre le **contenu**, c'est une chose ; comprendre l'**audience**, c'en est une autre — Izlen. »

---

## 💜 IZLEN — Pôle 3-B · Data / rétention · slides 7–10 *(~3 min)*

**[Slide 7 — divider]**
« Merci Rabah. Moi, je pars des **logs de visionnage** : chaque play, pause, retour en arrière. Bien analysés, ils disent **où** une vidéo perd son audience, et **lesquelles** retiennent le mieux. »

**[Slide 8 — rétention]**
« Premier volet : détecter les **zones d'ennui**. On combine quatre signaux de friction — les retours en arrière, la chute de rétention, les abandons, les pauses — et on extrait les zones anormales. Le point clé : on ne se contente pas d'**affirmer** que ça marche, on le **mesure** contre un corrigé humain. On obtient un **F1 de 0,77**, avec une précision de 0,69 et un rappel de 0,86. »

**[Slide 9 — prédiction]**
« Deuxième volet : **prédire** la rétention. Notre modèle Ridge atteint une erreur moyenne de **0,069** et un R² de **0,56**, en validation Leave-One-Out — il bat largement une baseline naïve. Le point d'honnêteté, essentiel : **aucune fuite de cible**. On a vérifié, feature par feature, qu'on n'utilise que des signaux **indépendants du résultat** — la catégorie, la durée, l'engagement précoce — **jamais** la rétention elle-même. Le corrigé sert uniquement à mesurer, jamais à entraîner. Notre signal numéro un : les retours en arrière. »

**[Slide 10 — lecture business]**
« Et surtout, ça devient **actionnable** : le tableau de bord traduit chaque constat en conseil concret pour le créateur — un décrochage précoce, on soigne l'accroche ; une chute finale, on remonte l'information clé plus tôt. Voilà pour l'IA. Mais toute cette intelligence, il faut la **protéger** — Enzo. »

---

## ❤️ ENZO — Pôle 2 · Sécurité · slides 11–14 *(~2 min 30)*

**[Slide 11 — divider]**
« Notre back-end part d'un principe : **ne faire confiance à personne**. La vidéo n'est **jamais** servie en clair. »

**[Slide 12 — code]**
« Elle est diffusée en **HLS chiffré, en AES-128**. La clé n'est délivrée par notre **serveur de clés** qu'après avoir tout revérifié : jeton valide, bonne entreprise, droit sur le contenu, clé non révoquée. Au moindre doute : 401, 403 ou 404. Le **refus est la valeur par défaut**. »

**[Slide 13 — preuve + anti-scraping]**
« La preuve, en direct : sans jeton, 401. Avec le bon utilisateur, on reçoit la clé. Un utilisateur d'une **autre entreprise** ? 404 — on ne révèle même pas que le contenu existe. Et si un admin **révoque** la clé, la lecture est coupée immédiatement, en 403. Deuxième sujet, l'**anti-aspiration** : on compte les segments par acteur en temps réel, et au-delà d'un seuil on **bloque réellement** — un 403 renvoyé à nginx. Plus un **watermark** par session et un dashboard live. »

**[Slide 14 — modèle de menace]**
« Et on reste **honnêtes** : filmer l'écran avec un téléphone reste possible. On ne prétend pas l'empêcher — d'où le watermark, traçable et dissuasif. On **assume nos limites**. La sécurité, c'est bien ; mais tout ça n'a de sens que si l'utilisateur a une vraie expérience — Alex. »

---

## 🔵 ALEX — Pôle 1 · Front / revue · slides 15–17 *(~2 min 30)*

**[Slide 15 — divider]**
« Merci Enzo. Notre pôle, c'est **ce que voit et manipule l'utilisateur**. »

**[Slide 16 — problème]**
« Le problème : aujourd'hui, un retour sur une vidéo se fait par mail — “à 1 minute 32, le logo en haut à droite est trop petit”. C'est imprécis, pénible, et ça part en allers-retours. »

**[Slide 17 — produit]**
« Avec Poulpium, on **dessine directement sur l'image** et on commente **un instant précis**. Le tracé est épinglé à la seconde exacte, et **partagé en direct** avec toute l'équipe. Sept outils d'annotation, des **coordonnées normalisées** — donc le dessin s'adapte à n'importe quel écran et se retrouve à l'identique entre les fenêtres. Les commentaires sont triés par instant, avec fils, statut résolu, et **persistés** côté serveur. Le temps réel passe par un **transport abstrait** : la même appli marche en multi-fenêtres hors-ligne, ou en réseau local via socket.io, sans changer une ligne. Et on est allés plus loin avec **Watch Together** : un présentateur pilote la lecture, les invités suivent à l'image près, avec recalage si ça dérive. Tout ça, c'est le produit — et il tourne **en production**. William. »

---

## 💚 WILLIAM — Prod + Bloc B · slides 18–22 *(~3 min)*

**[Slide 18 — divider]**
« Merci Alex. Dernier point, et pas des moindres : tout ça n'est pas sur un localhost — **c'est en ligne, en production**. »

**[Slide 19 — topologie]**
« On utilise un **tunnel Cloudflare**. Notre serveur ouvre une connexion **sortante** vers Cloudflare : **aucun port entrant ouvert**, aucune IP exposée — la surface d'attaque est réduite au minimum. L'appli est servie sur un vrai domaine, en HTTPS. »

**[Slide 20 — stack + chiffres]**
« Le déploiement : une seule commande, `docker compose up`. Quatre conteneurs, images tirées de notre registre GitHub, et **Watchtower** qui redéploie tout seul à chaque nouvelle version. Le tout tient dans **87 mégaoctets de RAM**. Et ce ne sont pas des chiffres théoriques : notre dashboard Cloudflare montre **39 visiteurs** et près de **9 000 requêtes** servies — avec **zéro port ouvert**. »

**[Slide 21 — Bloc B]**
« Pour recoller le tout : un même utilisateur, un seul jeton, ouvre une revue, le Core la sécurise, l'Engine l'analyse, et c'est servi en prod. **Un seul flux, de bout en bout.** »

**[Slide 22 — clôture]**
« Voilà Poulpium : la revue, la sécurité et l'IA ne sont pas juxtaposées — elles partagent une identité et un parcours, en production. Et pour vous le prouver, on ne va pas se contenter des slides : **on vous le montre en live, maintenant.** »
→ **DÉMO**.

---

# 🔴 Démo live (~5 min) — check-list

**Pilote : Alex** (clavier). **Narration : William**. Chacun peut compléter sur son pôle.

**À préparer :** onglet ouvert sur la prod (déconnecté), 2ᵉ fenêtre prête, une vidéo **déjà analysée par l'IA**, **plan B** (build local + captures du deck si le réseau lâche).

1. **Login `alice`** → « authentifié par le Core, vrai JWT ». *(0:30)*
2. **Ouvrir une revue** → « flux **HLS chiffré** + **watermark** de session ». *(0:40)*
3. **Annoter** (flèche + commentaire au timecode), 2ᵉ fenêtre → **apparaît en direct**. *(1:00)*
4. **Insights IA** → transcription, chapitres, **recherche** → saut au bon instant. *(1:00)*
5. **Watch Together** : « je présente », l'autre fenêtre suit. *(0:40)*
6. **(option)** révoquer une clé (admin) → lecture coupée en direct. *(0:40)*
7. **Chute** : « une appli, un login, en production. Merci. » *(0:20)*

**Version courte (si peu de temps) :** login → revue chiffrée → 1 commentaire en direct → Insights. Stop.

> ⚠️ Ne pas cliquer « supprimer » par erreur. Répéter le parcours **exact** avant.

---

# ❓ Q&A — réponses prêtes
- **Pourquoi des modèles locaux ?** → contrainte du sujet (100 % local, gratuit) + vie privée : aucune image ne sort. CPU-only.
- **Fuite de cible (P3-B) ?** → features indépendantes du dénouement seulement ; rétention/complétion bannies ; corrigé = évaluation. LOO-CV car 25 vidéos.
- **Un tunnel Cloudflare, risqué ?** → non : connexion sortante, aucun port entrant, TLS + WAF devant.
- **Bloquez-vous la capture d'écran ?** → non, et on l'assume ; best-effort + watermark traçable.
- **Temps réel, ça tient à combien ?** → testé 2–3 postes en LAN (socket.io), gateway scalable.
- **Vraiment intégré ?** → la démo le prouve : un login, un flux, les 3 pôles dans la même appli, en prod.
- **LLM sur CPU, fragile ?** → point sensible → dégradation gracieuse (résumé vide + chapitres de repli si le LLM échoue).

# ✅ Check-list matériel
- [ ] Prod joignable + vidéo **déjà analysée**.
- [ ] Deck en plein écran (`F`) ; chacun connaît ses n° de slides.
- [ ] 2ᵉ fenêtre navigateur prête · plan B (local + captures).
- [ ] Rôles démo : Alex clavier, William narre.
- [ ] Un chrono discret pour basculer à ~15 min.
