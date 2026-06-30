import { lazy, Suspense, useEffect, useState } from 'react'
import { ShieldCheck } from '@phosphor-icons/react'
import './App.css'
import Login from './Login.jsx'
import AppShell from './components/AppShell.jsx'
import Catalogue from './components/Catalogue.jsx'
import VideoReview from './components/VideoReview.jsx'
import Documentation from './components/Documentation.jsx'
import { getToken, logout, me, isAdmin } from './auth'

// Chargés à la demande : SecureVideo embarque hls.js (lourd) -> hors du bundle initial.
const SecureVideo = lazy(() => import('./components/SecureVideo.jsx'))
const SecurityDashboard = lazy(() => import('./components/SecurityDashboard.jsx'))

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

  const toCatalogue = () => setView({ name: 'catalogue' })
  const titles = {
    review: view.video?.title,
    secure: 'Lecture protégée',
    dashboard: 'Surveillance',
  }
  const showBack = ['review', 'secure', 'dashboard'].includes(view.name)

  // Accès admin discret (les utilisateurs non-admin ne le voient jamais).
  const adminButton =
    isAdmin() && view.name !== 'dashboard' ? (
      <button className="btn btn-ghost" onClick={() => setView({ name: 'dashboard' })}>
        <ShieldCheck size={16} weight="bold" />
        Surveillance
      </button>
    ) : null

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      onBack={showBack ? toCatalogue : undefined}
      onHome={toCatalogue}
      onOpenDocs={() => setView({ name: 'docs' })}
      title={titles[view.name]}
      right={adminButton}
    >
      {view.name === 'review' && (
        <VideoReview
          key={view.video.id}
          source={view.video.src}
          session={view.video.session ?? view.video.id}
          user={user}
        />
      )}
      {view.name === 'secure' && (
        <Suspense fallback={<Loading />}>
          <SecureVideo contentId={view.contentId ?? 'poc'} />
        </Suspense>
      )}
      {view.name === 'dashboard' && (
        <Suspense fallback={<Loading />}>
          <SecurityDashboard />
        </Suspense>
      )}
      {view.name === 'docs' && <Documentation onBack={toCatalogue} />}
      {view.name === 'catalogue' && (
        <Catalogue
          onOpen={(video) => setView({ name: 'review', video })}
          onOpenSecure={() => setView({ name: 'secure', contentId: 'poc' })}
        />
      )}
    </AppShell>
  )
}
