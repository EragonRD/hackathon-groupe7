# Tâche 32 — Dashboard d'audience (Streamlit) · Responsable : Faycal

## Objectif
Tableau de bord **lisible** : par vidéo, sa courbe de rétention et ses zones d'ennui ; comparaison entre vidéos ; affichage des prédictions du modèle.

## Entrées / Sorties
| Entrées | Sorties |
|---|---|
| `app/data/retention.py` (tâche 30), `app/data/model.py` (tâche 31) | App Streamlit `dashboard/app.py` |

## Dépendances
- Bloquée par : 00, 30, 31.
- Alimente : 33 (lecture business), View/Bloc B (insights).

## Étapes (checklist)
- [ ] ❌ Page « par vidéo » : courbe de rétention + zones d'ennui surlignées
- [ ] ❌ Page « comparaison » : classer/comparer les vidéos (rétention, durée, catégorie)
- [ ] ❌ Afficher prédictions modèle + métriques (MAE/R²)
- [ ] ❌ Filtres (catégorie, durée) + sélection vidéo
- [ ] ❌ Réutiliser les fonctions des tâches 30/31 (pas de recalcul dupliqué)
- [ ] ❌ `streamlit run dashboard/app.py` opérationnel localement

## Critères « fait »
- Dashboard se lance en 1 commande, lisible sans explication.
- Zones d'ennui et comparaison visibles d'un coup d'œil.
- Reproductible (données locales).

## Notes / pièges
- Lisibilité > nombre de graphiques.
- Mettre en cache (`@st.cache_data`) les calculs lourds.
