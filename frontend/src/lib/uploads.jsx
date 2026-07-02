import { createContext, useCallback, useContext, useState } from 'react'
import { uploadContent, grantAccess } from '../admin'
import { listMyContents } from '../contents'

// Gestionnaire d'uploads GLOBAL (monté au-dessus du routing) : l'envoi et le
// chiffrement se font en tâche de fond et s'affichent dans un TOAST non bloquant.
// L'utilisateur continue de naviguer pendant ce temps.
//
//   const { uploads, startUpload, dismiss } = useUploads()
//   startUpload({ file, title, category, invited })
//
// Chaque upload : { id, title, phase, progress, contentId, content?, error? }
//   phase : 'uploading' -> 'encrypting' -> 'ready' | 'error'

const UploadsContext = createContext(null)
let seq = 0

const POLL_MS = 1500
const ENCRYPT_TIMEOUT_MS = 10 * 60 * 1000

export function UploadsProvider({ children }) {
  const [uploads, setUploads] = useState([])

  const patch = useCallback((id, changes) => {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...changes } : u)))
  }, [])

  const dismiss = useCallback((id) => {
    setUploads((list) => list.filter((u) => u.id !== id))
  }, [])

  const startUpload = useCallback(
    ({ file, title, category, invited = [] }) => {
      const id = `up_${Date.now()}_${seq++}`
      const name = (title || '').trim() || file?.name || 'Vidéo'
      setUploads((list) => [
        ...list,
        {
          id,
          title: name,
          phase: 'uploading',
          progress: 0,
          contentId: null,
          error: null,
        },
      ])

      ;(async () => {
        try {
          // 1. Transfert du fichier (progress = % d'envoi).
          const content = await uploadContent({
            file,
            title: name,
            onProgress: (p) => patch(id, { progress: p }),
          })
          patch(id, { contentId: content.id, phase: 'encrypting', progress: 0 })

          // 2. Droits d'accès aux collaborateurs invités (best effort).
          await Promise.all(
            invited.map((u) => grantAccess(content.id, u).catch(() => null)),
          )

          // 3. Suivi du chiffrement HLS côté serveur (progress = % ffmpeg réel).
          const startedAt = Date.now()
          for (;;) {
            await new Promise((r) => setTimeout(r, POLL_MS))
            const list = await listMyContents().catch(() => [])
            const item = (list || []).find((c) => c.id === content.id)
            if (item) {
              if (typeof item.progress === 'number')
                patch(id, { progress: item.progress })
              if (item.status === 'ready') {
                patch(id, {
                  phase: 'ready',
                  progress: 100,
                  content: { ...content, category },
                })
                break
              }
              if (item.status === 'failed') {
                patch(id, {
                  phase: 'error',
                  error: 'Le chiffrement de la vidéo a échoué.',
                })
                break
              }
            }
            if (Date.now() - startedAt > ENCRYPT_TIMEOUT_MS) {
              patch(id, {
                phase: 'error',
                error: 'Chiffrement trop long (délai dépassé).',
              })
              break
            }
          }
        } catch (e) {
          patch(id, { phase: 'error', error: e?.message || "Échec de l'envoi." })
        }
      })()

      return id
    },
    [patch],
  )

  return (
    <UploadsContext.Provider value={{ uploads, startUpload, dismiss }}>
      {children}
    </UploadsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUploads() {
  const ctx = useContext(UploadsContext)
  if (!ctx) throw new Error('useUploads doit être utilisé dans <UploadsProvider>')
  return ctx
}
