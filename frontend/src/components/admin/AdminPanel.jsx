import { useCallback, useEffect, useState } from 'react'
import {
  Buildings,
  UsersThree,
  FilmSlate,
  ArrowClockwise,
  ShieldWarning,
} from '@phosphor-icons/react'
import { isSuperAdmin } from '../../auth'
import { listCompanies, listUsers, listContents } from '../../admin'
import CompaniesPanel from './CompaniesPanel'
import UsersPanel from './UsersPanel'
import ContentsPanel from './ContentsPanel'

// Récupère les données du back-office (fonction PURE : aucun setState). Un
// superadmin voit aussi les entreprises ; un admin n'appelle pas cette route.
async function loadData(superadmin) {
  // Le superadmin n'accède pas au contenu (route /admin/contents interdite) :
  // on charge les entreprises à la place et on saute la liste des contenus.
  const [companies, users, contents] = await Promise.all([
    superadmin ? listCompanies() : Promise.resolve([]),
    listUsers(),
    superadmin ? Promise.resolve([]) : listContents(),
  ])
  return { companies: companies ?? [], users: users ?? [], contents: contents ?? [] }
}

// Back-office multi-tenant. Les onglets s'adaptent au rôle : un superadmin gère
// aussi les entreprises (tenants) ; un admin d'entreprise ne voit que SES users
// et contenus. Le chargement des données est centralisé ici et redistribué aux
// panels avec un `reload` commun (après chaque mutation, on resynchronise tout).
export default function AdminPanel() {
  const superadmin = isSuperAdmin()

  // Le superadmin gère la plateforme (entreprises + comptes) mais n'a AUCUN
  // accès au contenu : pas d'onglet Contenus pour lui.
  const tabs = superadmin
    ? [
        { key: 'companies', label: 'Entreprises', icon: Buildings },
        { key: 'users', label: 'Utilisateurs', icon: UsersThree },
      ]
    : [
        { key: 'users', label: 'Utilisateurs', icon: UsersThree },
        { key: 'contents', label: 'Contenus', icon: FilmSlate },
      ]

  const [tab, setTab] = useState(tabs[0].key)
  const [companies, setCompanies] = useState([])
  const [users, setUsers] = useState([])
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Rechargement manuel (bouton Rafraîchir + après chaque mutation des panels).
  const reload = useCallback(async () => {
    try {
      const d = await loadData(superadmin)
      setCompanies(d.companies)
      setUsers(d.users)
      setContents(d.contents)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [superadmin])

  // Chargement initial : setState uniquement APRÈS le await, sous garde `alive`
  // (règle react-hooks/set-state-in-effect + évite un setState post-démontage).
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const d = await loadData(superadmin)
        if (!alive) return
        setCompanies(d.companies)
        setUsers(d.users)
        setContents(d.contents)
        setError(null)
      } catch (err) {
        if (alive) setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [superadmin])

  return (
    <div className="scroll-area">
      <div className="admin">
        <div className="dash-head">
          <div>
            <h1>Administration</h1>
            <p>
              {superadmin
                ? 'Gestion des entreprises, de leurs administrateurs et des contenus.'
                : 'Gestion des utilisateurs, des contenus et des accès de votre entreprise.'}
            </p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={reload}
            disabled={loading}
            title="Rafraîchir"
          >
            <ArrowClockwise size={15} weight="bold" />
            Rafraîchir
          </button>
        </div>

        <nav className="admin-tabs" role="tablist" aria-label="Sections d'administration">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`admin-tab ${tab === t.key ? 'is-active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <Icon size={16} weight={tab === t.key ? 'fill' : 'regular'} />
                {t.label}
              </button>
            )
          })}
        </nav>

        {error && (
          <div className="error-text" role="alert">
            <ShieldWarning size={16} weight="fill" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="admin-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="admin-body" role="tabpanel">
            {tab === 'companies' && (
              <CompaniesPanel companies={companies} users={users} reload={reload} />
            )}
            {tab === 'users' && (
              <UsersPanel
                users={users}
                companies={companies}
                superadmin={superadmin}
                reload={reload}
              />
            )}
            {tab === 'contents' && (
              <ContentsPanel
                contents={contents}
                users={users}
                companies={companies}
                superadmin={superadmin}
                reload={reload}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
