import { useState } from 'react'
import { UsersThree, ArrowRight } from '@phosphor-icons/react'
import PoulpiumMark from './PoulpiumMark'

// Écran d'entrée d'un INVITÉ (sans compte), atteint via un lien ?guest=<token>.
// Il choisit un nom d'affichage, puis rejoint la revue. Le token (déjà stocké)
// borne son accès dans le temps.
export default function GuestJoin({ onJoin }) {
  // Nom mémorisé (rechargement de page) : l'invité n'a qu'à confirmer.
  const [name, setName] = useState(() => {
    try {
      return sessionStorage.getItem('poulpium_guest_name') || ''
    } catch {
      return ''
    }
  })

  function submit(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    try {
      sessionStorage.setItem('poulpium_guest_name', n)
    } catch {
      /* mode privé / quota : sans persistance, on redemandera le nom */
    }
    onJoin(n)
  }

  return (
    <div className="pwd-screen">
      <form className="pwd-card" onSubmit={submit}>
        <div className="login-card-brand">
          <PoulpiumMark size={26} />
          <span>Poulpium</span>
        </div>
        <h2 className="login-title">Rejoindre la revue</h2>
        <p className="sub">
          Vous avez été invité à participer. Choisissez un nom affiché aux autres
          participants.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="guest-name">
            Votre nom
          </label>
          <div className="input-wrap">
            <UsersThree className="input-icon" size={17} weight="bold" />
            <input
              id="guest-name"
              className="has-icon"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Camille"
              autoFocus
            />
          </div>
        </div>
        <button
          className="btn btn-primary pwd-submit"
          type="submit"
          disabled={!name.trim()}
        >
          Entrer
          <ArrowRight size={15} weight="bold" />
        </button>
      </form>
    </div>
  )
}
