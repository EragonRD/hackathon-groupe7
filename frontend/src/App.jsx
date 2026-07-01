import { lazy, Suspense, useEffect, useState } from 'react'
import { ShieldCheck, Gear, UsersThree } from '@phosphor-icons/react'
import './App.css'
import Login from './Login.jsx'
import ChangePassword from './components/ChangePassword.jsx'
import GuestJoin from './components/GuestJoin.jsx'
import InviteGuestModal from './components/InviteGuestModal.jsx'
import AppShell from './components/AppShell.jsx'
import Catalogue from './components/Catalogue.jsx'
import VideoReview from './components/VideoReview.jsx'
import Documentation from './components/Documentation.jsx'
import { getToken, logout, me, isAdmin, mustChangePwd } from './auth'

// Chargés à la demande (hors bundle initial).
const SecurityDashboard = lazy(() => import('./components/SecurityDashboard.jsx'))
const AdminPanel = lazy(() => import('./components/admin/AdminPanel.jsx'))

// Lien d'invité : ?guest=<jwt> dans l'URL. On stocke le token (même clé que les
// membres -> réutilisé par hls.js et le socket), on décode sa portée, et on
// nettoie l'URL. Retourne { contentId, session } ou null.
function parseGuestLink() {
  try {
    const token = new URLSearchParams(window.location.search).get('guest')
    if (!token) return null
    localStorage.setItem('hackathon_token', token)
    const claims = JSON.parse(atob(token.split('.')[1]))
    window.history.replaceState({}, '', window.location.pathname)
    if (claims?.role !== 'guest' || !claims.contentId) return null
    return { contentId: claims.contentId, session: claims.session ?? claims.contentId }
  } catch {
    return null
  }
}

function Loading() {
  return (
    <div className="empty" style={{ flex: 1 }}>
      <p>Chargement…</p>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  // Mode invité d'abord (parseGuestLink stocke le token + nettoie l'URL) : il
  // conditionne l'écran de démarrage, donc `checking` s'initialise en fonction.
  const [guestMode] = useState(parseGuestLink) // { contentId, session } | null
  const [checking, setChecking] = useState(() => !guestMode && Boolean(getToken()))
  // view : { name: 'catalogue' } | { name: 'review', video } | { name: 'docs' }
  //      | { name: 'dashboard' } | { name: 'admin' }
  //   review.video.src peut être une vidéo locale (blob) OU un flux HLS chiffré
  //   (/videos/:id/index.m3u8) : VideoReview gère les deux (annotation dans les deux cas).
  const [view, setView] = useState({ name: 'catalogue' })
  const [reviewPeers, setReviewPeers] = useState([])
  const [inviteContent, setInviteContent] = useState(null)

  // Réhydrate la session si un token est déjà présent (rechargement de page).
  // En mode invité, on saute la réhydratation (pas de compte à récupérer).
  useEffect(() => {
    if (guestMode) return undefined
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
  }, [guestMode])

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

  // Invité (lien ?guest=) : entrée sans login. Après saisie du nom, on ouvre
  // directement la revue du contenu invité (flux protégé + room temps réel).
  if (guestMode && !user) {
    return (
      <GuestJoin
        onJoin={(name) => {
          setUser({ username: name, role: 'guest', companyId: null })
          setView({
            name: 'review',
            video: {
              id: guestMode.contentId,
              title: 'Session invité',
              src: `/videos/${guestMode.contentId}/index.m3u8`,
              session: guestMode.session,
            },
          })
        }}
      />
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
    dashboard: 'Surveillance',
    admin: 'Administration',
  }
  // Un invité (role 'guest') n'a ni catalogue ni back-office : pas de retour.
  const isGuest = user.role === 'guest'
  const showBack = !isGuest && ['review', 'dashboard', 'admin'].includes(view.name)

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

  // Inviter des participants : visible pour un membre (pas un invité) en revue.
  const inviteButton =
    !isGuest && view.name === 'review' && view.video?.id ? (
      <button
        className="btn btn-ghost"
        onClick={() => setInviteContent({ id: view.video.id, title: view.video.title })}
      >
        <UsersThree size={16} weight="bold" />
        Inviter
      </button>
    ) : null

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      onBack={showBack ? goToCatalogue : undefined}
      onHome={goToCatalogue}
      onOpenDocs={() => setView({ name: 'docs' })}
      title={titles[view.name]}
      right={
        <>
          {inviteButton}
          {adminButtons}
        </>
      }
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
          onOpenSecure={(content) =>
            setView({
              name: 'review',
              video: {
                id: content.id,
                title: content.title,
                // Flux HLS chiffré servi par le Core (même origine via le proxy).
                // La clé n'est délivrée que sur token autorisé (Zero-Trust).
                src: `/videos/${content.id}/index.m3u8`,
                session: content.id,
              },
            })
          }
          onOpenAdmin={() => setView({ name: 'admin' })}
        />
      )}
      {inviteContent && (
        <InviteGuestModal
          content={inviteContent}
          onClose={() => setInviteContent(null)}
        />
      )}
    </AppShell>
  )
}
