import {
  ChartLineUp,
  Target,
  Brain,
  Lightbulb,
  MagnifyingGlass,
  Info,
} from '@phosphor-icons/react'

// Synthèse P3-B (Audience & rétention) — volet Data du Pôle 3, livré par Zeloun.
// Vue de restitution POUR LE SUPERADMIN : chiffres et méthodo repris tels quels de
// `engine/docs/business-3b.md` (mesurés via `scripts/run_analysis_3b.py`). Aucune
// donnée live ici : l'API P3-B (bonus) tourne sur un port séparé non intégré au
// Core ; cette page rend la synthèse dans le front plutôt que seulement en .py.

const STATS = [
  {
    label: 'Détection zones d’ennui (F1)',
    value: '0.77',
    sub: 'précision 0.69 · rappel 0.86',
  },
  { label: 'Modèle rétention · MAE', value: '0.069', sub: 'Ridge (régularisé)' },
  { label: 'Modèle rétention · R²', value: '0.56', sub: 'Leave-One-Out CV' },
  { label: 'Baseline battue', value: '0.106', sub: 'MAE naïve → 0.069' },
]

const ACTIONS = [
  [
    'Zone d’ennui ponctuelle (pic de retours arrière / pauses / abandons)',
    'Revoir le montage à cet endroit précis',
  ],
  [
    'Décrochage précoce (< 85 % passent les 10 premiers %)',
    'Soigner l’accroche des premières secondes',
  ],
  [
    'Vidéo longue pour sa catégorie (> médiane et > 360 s)',
    'Raccourcir ou découper en chapitres',
  ],
  ['Chute finale (< 50 % atteignent la fin)', 'Déplacer l’information clé plus tôt'],
]

export default function RetentionSynthesisPanel() {
  return (
    <div className="p3b">
      <div className="p3b-head">
        <ChartLineUp size={20} weight="fill" />
        <div>
          <h2>Analyse d’audience et rétention (Pôle 3-B)</h2>
          <p>
            Volet Data du Pôle 3 : détection des zones d’ennui et prédiction de la
            rétention. Chiffres mesurés sur 25 vidéos, 100 % local.
          </p>
        </div>
      </div>

      <div className="p3b-stats">
        {STATS.map((s) => (
          <div key={s.label} className="p3b-stat">
            <span className="p3b-stat-num">{s.value}</span>
            <span className="p3b-stat-label">{s.label}</span>
            <span className="p3b-stat-sub">{s.sub}</span>
          </div>
        ))}
      </div>

      <section className="p3b-section">
        <h3>
          <Target size={15} weight="bold" /> Détection des zones d’ennui
        </h3>
        <p>
          Signal de friction par position combinant retours en arrière (poids fort), chute
          locale de rétention, abandons et pauses. Régions au-dessus du quantile 0.92, en
          union avec les décrochages progressifs (perte cumulée ≥ 10 %).
        </p>
        <p className="p3b-note">
          <Info size={13} weight="bold" /> Le corrigé (ground truth) n’entre jamais dans
          la détection : il sert uniquement à mesurer la qualité a posteriori (F1 = 0.77).
        </p>
      </section>

      <section className="p3b-section">
        <h3>
          <Brain size={15} weight="bold" /> Prédiction de la rétention
        </h3>
        <p>
          Cible : rétention par vidéo. Features sans fuite de cible (catégorie, durée,
          engagement précoce, fréquence de pauses et de retours arrière). Rétention,
          position moyenne, taux de complétion et corrigé sont explicitement bannis.
        </p>
        <p>
          Évaluation en Leave-One-Out CV (échantillon de 25 vidéos). Le modèle linéaire
          régularisé (Ridge, MAE 0.069, R² 0.56) généralise mieux que les arbres, qui
          surapprennent sur si peu de données.
        </p>
      </section>

      <section className="p3b-section">
        <h3>
          <MagnifyingGlass size={15} weight="bold" /> Signal dominant
        </h3>
        <p>
          Les retours en arrière (<code>seek_back</code>) sont à la fois le meilleur
          prédicteur de rétention et le meilleur détecteur de zones d’ennui : un
          spectateur qui rejoue un passage est le signal d’alerte n°1 d’un passage à
          revoir.
        </p>
      </section>

      <section className="p3b-section">
        <h3>
          <Lightbulb size={15} weight="bold" /> Constats et actions
        </h3>
        <table className="p3b-table">
          <thead>
            <tr>
              <th>Constat détecté</th>
              <th>Action recommandée</th>
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map(([c, a]) => (
              <tr key={c}>
                <td>{c}</td>
                <td>{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="p3b-section p3b-repro">
        <h3>Vue interactive complète</h3>
        <p>
          Le détail par vidéo (courbes, hotspots, comparaison, recommandations auto) vit
          dans le dashboard Streamlit et l’API JSON bonus, exécutés en local depuis{' '}
          <code>engine/</code> :
        </p>
        <pre className="p3b-code">
          {`streamlit run dashboard/app.py                       # dashboard, 4 onglets
uvicorn app.data.api.main:app --reload --port 8010   # API JSON, docs sur /docs`}
        </pre>
        <p className="p3b-note">
          <Info size={13} weight="bold" /> Ces outils lisent <code>data/*.csv</code> et
          tournent en quelques secondes sur CPU, sans clé payante.
        </p>
      </section>
    </div>
  )
}
