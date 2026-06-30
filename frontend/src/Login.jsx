import { useRef, useState } from 'react'
import {
  PencilSimpleLine,
  ChatCircleDots,
  UsersThree,
  ArrowRight,
  Warning,
} from '@phosphor-icons/react'
import PoulpiumMark from './components/PoulpiumMark'
import { login } from './auth'

// Écran d'authentification Poulpium — câblé sur le Core NestJS (POST /auth/login).
// `onAuthed(user)` est appelé une fois connecté.
// Interactivité : spotlight + parallaxe pilotés par le curseur (variables CSS,
// aucun re-render), yeux du poulpe qui suivent, bouton « marée » aquatique,
// tooltips bulle sur les features. Tout en transform/opacity.
const DEMO_ACCOUNTS = ['alice', 'bob', 'carol']

export default function Login({ onAuthed }) {
  const [username, setUsername] = useState('alice')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const asideRef = useRef(null)

  // Le curseur pilote la position du spotlight (--mx/--my) et la parallaxe.
  function handleAsideMove(e) {
    const el = asideRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', (e.clientX - r.left) / r.width)
    el.style.setProperty('--my', (e.clientY - r.top) / r.height)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = await login(username, password)
      onAuthed?.(user)
    } catch (err) {
      setError(err.message || 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <aside className="login-aside" ref={asideRef} onPointerMove={handleAsideMove}>
        <span className="login-spotlight" aria-hidden="true" />
        <div className="login-bubbles" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="login-hero">
          <div className="poulpium-lockup">
            <PoulpiumMark size={64} animated interactive />
            <h1 className="poulpium-word">Poulpium</h1>
          </div>
          <p className="poulpium-tag">Revue vidéo collaborative</p>
          <p className="login-pitch">
            Annotez chaque image, commentez à la seconde près, et suivez les retours de
            votre équipe en temps réel. Plusieurs bras sur une même vidéo.
          </p>
        </div>

        <ul className="login-features">
          <li className="login-feature" tabIndex={0}>
            <PencilSimpleLine size={19} weight="bold" />
            <span className="feature-label">
              Annotation au timecode (flèche, cadre, trait libre)
            </span>
            <span className="feature-tip" role="tooltip">
              <span className="feature-tip-window">
                <span className="tip-title">Dessinez sur l'image</span>
                <span className="tip-desc">
                  Flèche, cadre ou trait libre, en six couleurs. Chaque tracé est épinglé
                  à la seconde exacte de la vidéo.
                </span>
              </span>
            </span>
          </li>
          <li className="login-feature" tabIndex={0}>
            <ChatCircleDots size={19} weight="bold" />
            <span className="feature-label">
              Commentaires triés par instant, saut en un clic
            </span>
            <span className="feature-tip" role="tooltip">
              <span className="feature-tip-window">
                <span className="tip-title">Une timeline de retours</span>
                <span className="tip-desc">
                  Chaque commentaire pose un marqueur sur la barre de lecture. Un clic et
                  la vidéo saute à l'instant concerné.
                </span>
              </span>
            </span>
          </li>
          <li className="login-feature" tabIndex={0}>
            <UsersThree size={19} weight="bold" />
            <span className="feature-label">
              Multi-fenêtres en direct, export JSON réutilisable
            </span>
            <span className="feature-tip" role="tooltip">
              <span className="feature-tip-window">
                <span className="tip-title">Revue en temps réel</span>
                <span className="tip-desc">
                  Curseurs et annotations se synchronisent entre les fenêtres. Exportez la
                  session en JSON, réimportable à tout moment.
                </span>
              </span>
            </span>
          </li>
        </ul>
      </aside>

      <div className="login-form-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          {/* Marque rappelée côté formulaire (mobile : le panneau gauche est masqué) */}
          <div className="login-card-brand">
            <PoulpiumMark size={26} />
            <span>Poulpium</span>
          </div>

          <h2 className="login-title">Connexion</h2>
          <p className="sub">Accédez à votre espace de revue.</p>

          <div className="field">
            <label className="field-label" htmlFor="login-user">
              Utilisateur
            </label>
            <input
              id="login-user"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. alice"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-pass">
              Mot de passe
            </label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mot de passe"
            />
          </div>

          {error && (
            <div className="error-text" role="alert">
              <Warning size={16} weight="fill" />
              {error}
            </div>
          )}

          <button className="btn btn-primary btn-aqua" type="submit" disabled={busy}>
            <span className="aqua-fill" aria-hidden="true" />
            <span className="aqua-bubbles" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span className="aqua-label">
              {busy ? 'Connexion…' : 'Se connecter'}
              {!busy && (
                <span className="btn-icon-circle">
                  <ArrowRight size={15} weight="bold" />
                </span>
              )}
            </span>
          </button>

          <div className="demo-hint">
            Comptes de démonstration (mot de passe <code>password</code>) :
            <div className="demo-accounts">
              {DEMO_ACCOUNTS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setUsername(name)
                    setPassword('password')
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
