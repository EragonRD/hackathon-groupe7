import { lazy, Suspense, useEffect, useState } from 'react'
import { ShieldCheck, Gear } from '@phosphor-icons/react'
import './App.css'
import Login from './Login.jsx'
import ChangePassword from './components/ChangePassword.jsx'
import AppShell from './components/AppShell.jsx'
import Catalogue from './components/Catalogue.jsx'
import VideoReview from './components/VideoReview.jsx'
import Documentation from './components/Documentation.jsx'
import { getToken, logout, me, isAdmin, mustChangePwd } from './auth'

// Chargés à la demande : SecureVideo embarque hls.js (lourd) -> hors du bundle initial.
const SecureVideo = lazy(() => import('./components/SecureVideo.jsx'))
const SecurityDashboard = lazy(() => import('./components/SecurityDashboard.jsx'))
const AdminPanel = lazy(() => import('./components/admin/AdminPanel.jsx'))

function Loading() {
  return (
    <div className="empty" style={{ flex: 1 }}>
      <p>Chargement…</p>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(getToken()))
  // view : { name: 'catalogue' } | { name: 'review', video } | { name: 'docs' }
  //      | { name: 'secure', contentId } | { name: 'dashboard' }
  const [view, setView] = useState({ name: 'catalogue' })
  const [reviewPeers, setReviewPeers] = useState([])

  // Réhydrate la session si un token est déjà présent (rechargement de page).
  useEffect(() => {
    let alive = true
    if (getToken()) {
      me().then((u) => {
        if (alive) {
          setUser(u)
          setChecking(false)
        }
      })
    }
    return () => {
      alive = false
    }
  }, [])

  // Token expiré (intercepteur 401 d'authFetch) -> retour à l'écran de connexion.
  useEffect(() => {
    function onExpired() {
      setUser(null)
      setView({ name: 'catalogue' })
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  function handleLogout() {
    logout()
    setUser(null)
    setView({ name: 'catalogue' })
  }

  if (checking) {
    return (
      <div className="app">
        <div className="empty" style={{ flex: 1 }}>
          <p>Reconnexion…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onAuthed={setUser} />
  }

  // Admin invité : tant que le mot de passe temporaire n'est pas remplacé, le
  // Core bloque tout /admin/* (403). On force l'écran de changement avant tout.
  if (mustChangePwd()) {
    return (
      <ChangePassword user={user} onDone={(u) => setUser(u)} onLogout={handleLogout} />
    )
  }

  function goToCatalogue() {
    setReviewPeers([])
    setView({ name: 'catalogue' })
  }
  const titles = {
    review: view.video?.title,
    secure: view.video?.title ?? 'Lecture protégée',
    dashboard: 'Surveillance',
    admin: 'Administration',
  }
  const showBack = ['review', 'secure', 'dashboard', 'admin'].includes(view.name)

  // Accès réservés (les non-admins ne les voient jamais). isAdmin() inclut le
  // superadmin ; le panel adapte ensuite ses onglets au rôle exact.
  const adminButtons = isAdmin() ? (
    <>
      {view.name !== 'admin' && (
        <button className="btn btn-ghost" onClick={() => setView({ name: 'admin' })}>
          <Gear size={16} weight="bold" />
          Administration
        </button>
      )}
      {view.name !== 'dashboard' && (
        <button className="btn btn-ghost" onClick={() => setView({ name: 'dashboard' })}>
          <ShieldCheck size={16} weight="bold" />
          Surveillance
        </button>
      )}
    </>
  ) : null

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      onBack={showBack ? goToCatalogue : undefined}
      onHome={goToCatalogue}
      onOpenDocs={() => setView({ name: 'docs' })}
      title={titles[view.name]}
      right={adminButtons}
      peers={reviewPeers}
    >
      {view.name === 'review' && (
        <VideoReview
          key={view.video.id}
          source={view.video.src}
          session={view.video.session ?? view.video.id}
          user={user}
          onPeersUpdate={setReviewPeers}
        />
      )}
      {view.name === 'secure' && (
        <Suspense fallback={<Loading />}>
          <SecureVideo
            contentId={view.contentId}
            src={view.video?.src}
            title={view.video?.title}
            category={view.video?.category}
            invited={view.video?.invited}
          />
        </Suspense>
      )}
      {view.name === 'dashboard' && (
        <Suspense fallback={<Loading />}>
          <SecurityDashboard />
        </Suspense>
      )}
      {view.name === 'admin' && (
        <Suspense fallback={<Loading />}>
          <AdminPanel />
        </Suspense>
      )}
      {view.name === 'docs' && <Documentation onBack={goToCatalogue} />}
      {view.name === 'catalogue' && (
        <Catalogue
          onOpen={(video) => setView({ name: 'secure', video })}
          onOpenSecure={() => setView({ name: 'secure', contentId: 'poc' })}
        />
      )}
    </AppShell>
  )
}
