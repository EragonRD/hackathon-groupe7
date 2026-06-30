import { useRef, useState } from 'react'
import { FilmSlate, Play, FolderOpen, LockSimple } from '@phosphor-icons/react'
import { SAMPLE, CATALOGUE_META } from '../data/videos'
import { formatTime, shortId } from '../lib/format'

// Grille de sélection. `onOpen(video)` ouvre la vidéo en mode revue.
export default function Catalogue({ onOpen }) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function openLocalFile(file) {
    if (!file) return
    const url = URL.createObjectURL(file)
    onOpen({
      id: `local-${shortId()}`,
      title: file.name,
      src: url,
      // Session locale partagée : permet la démo multi-fenêtres si chaque
      // fenêtre charge un fichier (les annotations se synchronisent par session).
      session: 'local',
      playable: true,
    })
  }

  return (
    <div className="scroll-area">
      <div className="catalogue">
        <div className="cat-head">
          <div>
            <h1>Catalogue</h1>
            <p>Choisissez une vidéo à réviser, ou chargez la vôtre.</p>
          </div>
        </div>

        <div className="cat-grid">
          {/* Entrée jouable réelle */}
          <button className="vid-card" onClick={() => onOpen(SAMPLE)}>
            <div className="vid-thumb">
              <FilmSlate size={34} weight="light" color="var(--text-faint)" />
              <div className="play-badge">
                <Play size={40} weight="fill" />
              </div>
            </div>
            <div className="vid-meta">
              <div className="vid-title">{SAMPLE.title}</div>
              <div className="vid-sub">
                <span className="badge badge-accent">Jouable</span>
                {SAMPLE.category}
              </div>
            </div>
          </button>

          {/* Charger une vidéo locale (drag & drop ou sélection) */}
          <div
            className={`dropzone${dragging ? ' drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              openLocalFile(e.dataTransfer.files?.[0])
            }}
          >
            <FolderOpen size={22} weight="light" />
            <div>
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                Charger une vidéo locale
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => openLocalFile(e.target.files?.[0])}
              />
            </div>
          </div>

          {/* Métadonnées du catalogue (data/videos.csv) — fichier non fourni */}
          {CATALOGUE_META.map((v) => (
            <button
              key={v.id}
              className="vid-card"
              disabled
              title="Métadonnées seulement — déposez le fichier pour l'activer"
            >
              <div className="vid-thumb">
                <img src={v.thumb} alt="" loading="lazy" />
                <span className="dur">{formatTime(v.duration_sec)}</span>
              </div>
              <div className="vid-meta">
                <div className="vid-title">{v.title}</div>
                <div className="vid-sub">
                  <LockSimple size={13} weight="bold" />
                  {v.category} · métadonnées
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
