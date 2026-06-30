import { useState } from 'react'
import {
  FilmSlate,
  PencilSimpleLine,
  ChatCircleDots,
  UsersThree,
  ArrowRight,
  Warning,
} from '@phosphor-icons/react'
import { login } from './auth'

// Écran d'authentification — câblé sur le Core NestJS (POST /auth/login).
// `onAuthed(user)` est appelé une fois connecté.
const DEMO_ACCOUNTS = ['alice', 'bob', 'carol']

export default function Login({ onAuthed }) {
  const [username, setUsername] = useState('alice')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

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
      <aside className="login-aside">
        <div className="brand">
          <span className="brand-mark">
            <FilmSlate size={18} weight="fill" />
          </span>
          <span>
            Revue
            <small>Lecteur de revue augmenté</small>
          </span>
        </div>

        <div>
          <span className="kicker">Pôle 1 · Application & Collaboration</span>
          <h2>Commentez la vidéo à l'image près, ensemble et en direct.</h2>
          <p>
            Dessinez sur la frame, épinglez un commentaire au timecode exact, et voyez les
            retours de votre équipe apparaître en temps réel.
          </p>
        </div>

        <div>
          <div className="login-feature">
            <PencilSimpleLine size={18} weight="bold" />
            Annotation au timecode (flèche, cadre, trait libre)
          </div>
          <div className="login-feature">
            <ChatCircleDots size={18} weight="bold" />
            Commentaires triés par instant, saut en un clic
          </div>
          <div className="login-feature">
            <UsersThree size={18} weight="bold" />
            Multi-fenêtres en direct, export JSON réutilisable
          </div>
        </div>
      </aside>

      <div className="login-form-wrap">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Connexion</h1>
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

          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy}
            style={{ width: '100%' }}
          >
            {busy ? 'Connexion…' : 'Se connecter'}
            {!busy && <ArrowRight size={16} weight="bold" />}
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
