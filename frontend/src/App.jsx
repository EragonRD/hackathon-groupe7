import { useEffect, useState } from 'react'
import './App.css'
import Login from './Login.jsx'
import AppShell from './components/AppShell.jsx'
import Catalogue from './components/Catalogue.jsx'
import VideoReview from './components/VideoReview.jsx'
import Documentation from './components/Documentation.jsx'
import { getToken, logout, me } from './auth'

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(Boolean(getToken()))
  // view : { name: 'catalogue' } | { name: 'review', video }
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

  const inReview = view.name === 'review'
  const inDocs = view.name === 'docs'

  function goToCatalogue() {
    setReviewPeers([])
    setView({ name: 'catalogue' })
  }

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      onBack={inReview ? goToCatalogue : undefined}
      onHome={goToCatalogue}
      onOpenDocs={() => setView({ name: 'docs' })}
      title={inReview ? view.video.title : undefined}
      peers={reviewPeers}
    >
      {inReview ? (
        <VideoReview
          key={view.video.id}
          source={view.video.src}
          session={view.video.session ?? view.video.id}
          user={user}
          onPeersUpdate={setReviewPeers}
        />
      ) : inDocs ? (
        <Documentation onBack={goToCatalogue} />
      ) : (
        <Catalogue onOpen={(video) => setView({ name: 'review', video })} />
      )}
    </AppShell>
  )
}
