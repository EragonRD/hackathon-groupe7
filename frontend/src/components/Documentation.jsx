import {
  Play,
  Pause,
  PencilSimple,
  ChatCircle,
  Users,
  Export,
  FileCode,
  Lock,
  MagnifyingGlass,
  ChartBar,
  FolderOpen,
} from '@phosphor-icons/react'

export default function Documentation({ onBack }) {
  return (
    <div className="scroll-area">
      <div className="doc-page">
        <header className="doc-header">
          <h1>Documentation</h1>
          <p>Plateforme vidéo collaborative — Lecteur de revue augmenté</p>
        </header>

        {/* ================================================================
            DOCUMENTATION D'UTILISATION
        ================================================================ */}
        <section className="doc-section">
          <h2 className="doc-part">Documentation d'utilisation</h2>

          <h3>Connexion</h3>
          <p className="doc-p">Utilisez l'un des comptes de démo pour vous connecter :</p>
          <div className="doc-table">
            <div className="doc-tr doc-th">
              <span>Utilisateur</span>
              <span>Rôle</span>
              <span>Mot de passe</span>
            </div>
            <div className="doc-tr">
              <span>
                <code>alice</code>
              </span>
              <span className="badge badge-accent">admin</span>
              <span>
                <code>password</code>
              </span>
            </div>
            <div className="doc-tr">
              <span>
                <code>bob</code>
              </span>
              <span className="badge">user</span>
              <span>
                <code>password</code>
              </span>
            </div>
            <div className="doc-tr">
              <span>
                <code>carol</code>
              </span>
              <span className="badge">user</span>
              <span>
                <code>password</code>
              </span>
            </div>
          </div>
        </section>

        <section className="doc-section">
          <h3>Catalogue vidéo</h3>
          <p className="doc-p">
            Après connexion, vous arrivez sur le catalogue. Vous pouvez :
          </p>
          <ul className="doc-list">
            <li>
              <Play size={14} /> Ouvrir la vidéo d'exemple jouable pour la réviser
            </li>
            <li>
              <FolderOpen size={14} /> Charger votre propre vidéo locale (glisser-déposer
              ou sélection)
            </li>
            <li>Parcourir les métadonnées des vidéos disponibles</li>
          </ul>
        </section>

        <section className="doc-section">
          <h3>Lecteur de revue</h3>

          <h4>Contrôles de lecture</h4>
          <ul className="doc-list">
            <li>
              <Play size={14} /> <strong>Play / Pause</strong> — bouton central ou clavier
              (espace)
            </li>
            <li>
              <strong>Barre de défilement</strong> — cliquer ou glisser pour se déplacer
              dans la vidéo
            </li>
            <li>
              <strong>Timecode</strong> — affiché en bas à gauche (temps courant / durée
              totale)
            </li>
            <li>
              <strong>Marqueurs</strong> — points colorés sur la barre indiquant les
              commentaires existants
            </li>
          </ul>

          <h4>Annotations</h4>
          <ul className="doc-list">
            <li>
              Sélectionnez un outil de dessin dans la barre d'outils (flèche, trait libre,
              rectangle, texte)
            </li>
            <li>Choisissez une couleur parmi la palette</li>
            <li>Dessinez directement sur l'image vidéo</li>
            <li>Chaque annotation est automatiquement rattachée au timecode courant</li>
          </ul>

          <h4>Commentaires</h4>
          <ul className="doc-list">
            <li>Le panneau latéral droit liste tous les commentaires de la session</li>
            <li>Chaque commentaire affiche l'auteur, le timecode et le contenu</li>
            <li>Cliquez sur un commentaire pour sauter à l'instant correspondant</li>
            <li>Utilisez le compositeur en bas du panneau pour ajouter un commentaire</li>
          </ul>
        </section>

        <section className="doc-section">
          <h3>Collaboration en temps réel</h3>
          <ul className="doc-list">
            <li>
              <Users size={14} /> Plusieurs utilisateurs peuvent rejoindre la même session
              de revue
            </li>
            <li>Les curseurs des autres participants sont visibles sur l'image</li>
            <li>
              Les annotations et commentaires se synchronisent en direct via Socket.IO
            </li>
            <li>
              Les pastilles de présence (en haut à droite) montrent qui est connecté
            </li>
          </ul>
        </section>

        <section className="doc-section">
          <h3>Export</h3>
          <ul className="doc-list">
            <li>
              <Export size={14} /> Exportez toutes les annotations et commentaires en JSON
            </li>
            <li>
              Le format inclut : timecode, auteur, type d'annotation, coordonnées,
              couleur, commentaire
            </li>
            <li>Idéal pour intégration dans d'autres outils ou archivage</li>
          </ul>
        </section>

        <hr className="doc-hr" />

        {/* ================================================================
            DOCUMENTATION DU PROJET
        ================================================================ */}
        <section className="doc-section">
          <h2 className="doc-part">Documentation du projet</h2>
          <p className="doc-p">
            Projet réalisé dans le cadre du <strong>Hackathon ESTIAM</strong> — Plateforme
            vidéo collaborative déclinée en 3 pôles.
          </p>
        </section>

        <section className="doc-section">
          <h3>Architecture</h3>
          <div className="doc-arch">
            <div className="arch-card">
              <h3>View</h3>
              <p>Frontend React (Vite)</p>
              <span>Interface utilisateur</span>
            </div>
            <div className="arch-arrow">&rarr;</div>
            <div className="arch-card core">
              <h3>Core</h3>
              <p>API NestJS</p>
              <span>Auth + règles métier</span>
            </div>
            <div className="arch-arrow">&rarr;</div>
            <div className="arch-card engine">
              <h3>Engine</h3>
              <p>Python</p>
              <span>Traitements IA / Data</span>
            </div>
          </div>
        </section>

        <section className="doc-section">
          <h3>Pôle 1 — Lecteur de Revue augmenté</h3>
          <p className="doc-p">
            Faire d'un lecteur vidéo un espace de revue collaboratif : on dessine sur
            l'image et on commente un instant précis, à plusieurs et en direct.
          </p>
          <ul className="doc-list">
            <li>
              Annotations dessinées sur l'image (flèche, trait libre, formes, texte)
            </li>
            <li>Commentaires rattachés à un timecode précis</li>
            <li>
              Collaboratif en temps réel (Socket.IO) — plusieurs utilisateurs dans une
              salle
            </li>
            <li>Export JSON des annotations + commentaires</li>
            <li>
              Composant réutilisable : source vidéo, utilisateur, session passés en props
            </li>
          </ul>
        </section>

        <section className="doc-section">
          <h3>Pôle 2 — Infrastructure &amp; Sécurité</h3>
          <p className="doc-p">
            Protéger la diffusion des contenus et détecter les abus, avec une
            infrastructure reproductible.
          </p>
          <ul className="doc-list">
            <li>
              <Lock size={14} /> Diffusion HLS chiffrée AES-128
            </li>
            <li>
              <Lock size={14} /> Serveur de clés éphémères (token JWT requis)
            </li>
            <li>
              <MagnifyingGlass size={14} /> Détection anti-scraping et sessions
              simultanées anormales
            </li>
            <li>
              <MagnifyingGlass size={14} /> Rate-limiting et blocage IP suspectes
              (VPN/proxy)
            </li>
            <li>Déploiement Docker local</li>
          </ul>
        </section>

        <section className="doc-section">
          <h3>Pôle 3 — IA &amp; Data</h3>
          <p className="doc-p">
            Rendre le contenu vidéo exploitable et tirer des insights des données d'usage.
          </p>
          <ul className="doc-list">
            <li>
              <FileCode size={14} /> Pipeline Python de transcription Whisper (100% local)
            </li>
            <li>
              <FileCode size={14} /> Extraction de métadonnées : résumé, chapitres,
              mots-clés
            </li>
            <li>
              <FileCode size={14} /> Traduction et segmentation horodatée
            </li>
            <li>
              <ChartBar size={14} /> Analyse d'audience et prédiction de rétention
            </li>
            <li>
              <ChartBar size={14} /> Dashboard des zones d'ennui par vidéo
            </li>
          </ul>
        </section>

        <section className="doc-section">
          <h3>Authentification (API)</h3>
          <div className="doc-auth">
            <div className="auth-row">
              <code>POST /auth/login</code>
              <span>{'{ username, password } → JWT + profil utilisateur'}</span>
            </div>
            <div className="auth-row">
              <code>GET /auth/me</code>
              <span>
                Route protégée — retourne l'utilisateur connecté (nécessite token)
              </span>
            </div>
          </div>
        </section>

        <section className="doc-section">
          <h3>Stack technique</h3>
          <div className="doc-stack">
            <span className="stack-chip">React 19</span>
            <span className="stack-chip">Vite 8</span>
            <span className="stack-chip">Socket.IO</span>
            <span className="stack-chip">NestJS 11</span>
            <span className="stack-chip">Argon2</span>
            <span className="stack-chip">JWT</span>
            <span className="stack-chip">HLS</span>
            <span className="stack-chip">Whisper</span>
            <span className="stack-chip">Ollama</span>
            <span className="stack-chip">Docker</span>
          </div>
        </section>

        <section className="doc-section">
          <h3>Démarrage</h3>
          <div className="doc-code">
            <pre>
              {
                '# Backend\ncd backend && npm install && npm run start:dev\n\n# Frontend\ncd frontend && npm install && npm run dev\n\n# Engine (Python)\n# cf. docs/python-env.md'
              }
            </pre>
          </div>
        </section>
      </div>
    </div>
  )
}
