import { useRef, useState } from 'react'
import {
  FilmSlate,
  Play,
  FolderOpen,
  LockSimple,
  ShieldCheck,
} from '@phosphor-icons/react'
import { SAMPLE, CATALOGUE_META } from '../data/videos'
import { formatTime, shortId } from '../lib/format'
import VideoUploadModal from './VideoUploadModal'

export default function Catalogue({ onOpen, onOpenSecure }) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [uploadFile, setUploadFile] = useState(null)

  function handleFileSelected(file) {
    if (!file) return
    setUploadFile(file)
  }

  function handleUploadConfirm(meta) {
    const url = URL.createObjectURL(uploadFile)
    onOpen({
      id: `local-${shortId()}`,
      title: meta.title,
      src: url,
      session: 'local',
      playable: true,
      category: meta.category,
      invited: meta.invited,
    })
    setUploadFile(null)
  }

  function handleUploadCancel() {
    setUploadFile(null)
  }

  return (
    <div className="scroll-area">
      <div className="catalogue">
        <div className="cat-head"></div>

        <div className="cat-grid">
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
              handleFileSelected(e.dataTransfer.files?.[0])
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
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
            </div>
          </div>
          <button className="vid-card" onClick={() => onOpen({ ...SAMPLE })}>
            <div className="vid-thumb">
              <FilmSlate size={34} weight="light" color="var(--text-faint)" />
              <div className="play-badge">
                <Play size={40} weight="fill" />
              </div>
            </div>
            <div className="vid-meta">
              <div className="vid-title">{SAMPLE.title}</div>
              <div className="vid-sub">
                <span className="badge badge-accent">Disponible</span>
                {SAMPLE.category}
              </div>
            </div>
          </button>

          {onOpenSecure && (
            <button className="vid-card" onClick={onOpenSecure}>
              <div className="vid-thumb">
                <ShieldCheck size={34} weight="light" color="var(--accent-strong)" />
                <div className="play-badge">
                  <Play size={40} weight="fill" />
                </div>
              </div>
              <div className="vid-meta">
                <div className="vid-title">Présentation sécurisée</div>
                <div className="vid-sub">
                  <span className="badge badge-accent">
                    <LockSimple size={12} weight="bold" />
                    Protégé
                  </span>
                  Lecture en streaming
                </div>
              </div>
            </button>
          )}

          {CATALOGUE_META.length === 0 && (
            <div className="empty catalogue-empty">
              <FilmSlate size={38} weight="light" />
              <p>
                Aucune vidéo dans le catalogue. Chargez une vidéo locale pour commencer.
              </p>
            </div>
          )}

          {CATALOGUE_META.map((v) => (
            <button key={v.id} className="vid-card" disabled title="Bientôt disponible">
              <div className="vid-thumb">
                <img src={v.thumb} alt="" loading="lazy" />
                <span className="dur">{formatTime(v.duration_sec)}</span>
              </div>
              <div className="vid-meta">
                <div className="vid-title">{v.title}</div>
                <div className="vid-sub">
                  <LockSimple size={13} weight="bold" />
                  {v.category} · bientôt
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {uploadFile && (
        <VideoUploadModal
          file={uploadFile}
          onCancel={handleUploadCancel}
          onConfirm={handleUploadConfirm}
        />
      )}
    </div>
  )
}
