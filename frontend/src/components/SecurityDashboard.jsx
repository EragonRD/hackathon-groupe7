import { useEffect, useState } from 'react'
import { ShieldWarning, Pulse, Lock, Prohibit, Flag } from '@phosphor-icons/react'
import { authFetch } from '../auth'

// Tableau de bord sécurité (admin). Libellés en clair pour un public non
// technique. Rafraîchi toutes les 2 s. Données servies par le Core (Pôle 2).
const COUNTERS = [
  { key: 'recentRequests', label: 'Requêtes récentes' },
  { key: 'activeAlerts', label: 'Alertes actives' },
  { key: 'uniqueIps', label: 'Visiteurs uniques' },
  { key: 'segmentRequests', label: 'Segments lus' },
]

const ALERT_LABELS = {
  multi_session: 'Sessions multiples',
  proxy_ip: 'Connexion via proxy',
  segment_scrape: 'Aspiration détectée',
}

function timeOnly(ts) {
  try {
    return new Date(ts).toLocaleTimeString('fr-FR')
  } catch {
    return ts
  }
}

export default function SecurityDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function poll() {
      try {
        const res = await authFetch('/security/dashboard')
        if (!alive) return
        if (res.status === 403) {
          setError('Cet espace est réservé aux administrateurs.')
          return
        }
        if (!res.ok) {
          setError('Tableau de bord momentanément indisponible.')
          return
        }
        setError(null)
        setData(await res.json())
      } catch {
        if (alive) setError('Service de surveillance injoignable.')
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  if (error) {
    return (
      <div className="scroll-area">
        <div className="dash">
          <div className="empty" style={{ minHeight: '50vh' }}>
            <ShieldWarning size={40} weight="light" />
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  const counters = data?.counters ?? {}
  const alerts = data?.alerts ?? []
  const traffic = (data?.recentTraffic ?? []).slice(-8).reverse()

  return (
    <div className="scroll-area">
      <div className="dash">
        <div className="dash-head">
          <div>
            <h1>Surveillance</h1>
            <p>État de la diffusion et activité suspecte, en direct.</p>
          </div>
          <span className="badge badge-accent">
            <Pulse size={13} weight="fill" />
            En direct
          </span>
        </div>

        <div className="dash-counters">
          {COUNTERS.map((c) => (
            <div key={c.key} className="dash-counter">
              <span className="dash-num tnum">{counters[c.key] ?? 0}</span>
              <span className="dash-label">{c.label}</span>
            </div>
          ))}
        </div>

        <div className="dash-grid">
          <section className="dash-card">
            <h3>
              Alertes <span className="count">· {alerts.length}</span>
            </h3>
            {alerts.length === 0 ? (
              <div className="dash-ok">
                <Lock size={18} weight="fill" />
                Aucune activité suspecte.
              </div>
            ) : (
              <ul className="dash-alerts">
                {alerts
                  .slice()
                  .reverse()
                  .map((a, i) => (
                    <li key={i} className="dash-alert">
                      <span className={`dash-action ${a.action}`}>
                        {a.action === 'block' ? (
                          <Prohibit size={14} weight="bold" />
                        ) : (
                          <Flag size={14} weight="bold" />
                        )}
                        {a.action === 'block' ? 'Bloqué' : 'Signalé'}
                      </span>
                      <div className="dash-alert-body">
                        <span className="dash-alert-type">
                          {ALERT_LABELS[a.type] ?? a.type}
                        </span>
                        <span className="dash-alert-meta">
                          {a.account ?? 'inconnu'} · {a.ip} · {timeOnly(a.ts)}
                        </span>
                        {a.detail && (
                          <span className="dash-alert-detail">{a.detail}</span>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <h3>Activité récente</h3>
            {traffic.length === 0 ? (
              <div className="dash-ok">En attente d'activité…</div>
            ) : (
              <ul className="dash-traffic">
                {traffic.map((t, i) => (
                  <li key={i}>
                    <span className="dash-traffic-time tnum">{timeOnly(t.ts)}</span>
                    <span className="dash-traffic-acc">{t.account ?? '—'}</span>
                    <span className="dash-traffic-path">{t.path}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
