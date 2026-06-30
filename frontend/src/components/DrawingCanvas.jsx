import { useCallback, useEffect, useRef, useState } from 'react'

// Calque de dessin superposé à la vidéo.
// - Coordonnées NORMALISÉES (0..1) -> les formes s'adaptent à toute taille
//   d'affichage et se mappent à l'identique d'une fenêtre à l'autre.
// - Outils : 'cursor' (navigation), 'pen', 'arrow', 'rect', 'ellipse', 'text'.
// - `shapes` : formes à afficher (brouillon courant + note active).
// - onAddShape(shape) : forme terminée. onCursor(nx,ny) : suivi du pointeur.
//   onBackgroundClick() : clic en mode 'cursor' (utilisé pour play/pause).
const LINE_WIDTH = 3
const TEXT_FONT_RATIO = 0.04

function drawArrowHead(ctx, from, to, w, h) {
  const ax = from.x * w
  const ay = from.y * h
  const bx = to.x * w
  const by = to.y * h
  const angle = Math.atan2(by - ay, bx - ax)
  const len = 12
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(
    bx - len * Math.cos(angle - Math.PI / 7),
    by - len * Math.sin(angle - Math.PI / 7),
  )
  ctx.moveTo(bx, by)
  ctx.lineTo(
    bx - len * Math.cos(angle + Math.PI / 7),
    by - len * Math.sin(angle + Math.PI / 7),
  )
  ctx.stroke()
}

function drawShape(ctx, s, w, h) {
  ctx.strokeStyle = s.color
  ctx.lineWidth = LINE_WIDTH
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (s.tool === 'pen') {
    const pts = s.points || []
    if (pts.length < 2) {
      if (pts.length === 1) {
        ctx.beginPath()
        ctx.arc(pts[0].x * w, pts[0].y * h, LINE_WIDTH / 2, 0, Math.PI * 2)
        ctx.fillStyle = s.color
        ctx.fill()
      }
      return
    }
    ctx.beginPath()
    ctx.moveTo(pts[0].x * w, pts[0].y * h)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h)
    ctx.stroke()
  } else if (s.tool === 'rect') {
    const x = s.from.x * w
    const y = s.from.y * h
    ctx.strokeRect(x, y, (s.to.x - s.from.x) * w, (s.to.y - s.from.y) * h)
  } else if (s.tool === 'ellipse') {
    const x1 = s.from.x * w
    const y1 = s.from.y * h
    const x2 = s.to.x * w
    const y2 = s.to.y * h
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2
    const rx = Math.abs(x2 - x1) / 2
    const ry = Math.abs(y2 - y1) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (s.tool === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(s.from.x * w, s.from.y * h)
    ctx.lineTo(s.to.x * w, s.to.y * h)
    ctx.stroke()
    drawArrowHead(ctx, s.from, s.to, w, h)
  } else if (s.tool === 'text') {
    const value = (s.value || '').trim()
    if (!value) return
    const fontSize = Math.max(14, Math.round(h * TEXT_FONT_RATIO))
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.textBaseline = 'top'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.lineWidth = Math.max(3, fontSize * 0.18)
    ctx.strokeText(value, s.at.x * w, s.at.y * h)
    ctx.fillStyle = s.color
    ctx.fillText(value, s.at.x * w, s.at.y * h)
  }
}

export default function DrawingCanvas({
  tool,
  color,
  shapes,
  onAddShape,
  onBeginAnnotation,
  onCursor,
  onBackgroundClick,
}) {
  const canvasRef = useRef(null)
  const textInputRef = useRef(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const draftRef = useRef(null)
  const shapesRef = useRef(shapes)
  const [textDraft, setTextDraft] = useState(null)

  const redraw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const { w, h } = sizeRef.current
    const ctx = cv.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    for (const s of shapesRef.current) drawShape(ctx, s, w, h)
    if (draftRef.current) drawShape(ctx, draftRef.current, w, h)
  }, [])

  // Taille du canvas alignée sur l'élément affiché.
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ro = new ResizeObserver(() => {
      const r = cv.getBoundingClientRect()
      sizeRef.current = { w: r.width, h: r.height }
      redraw()
    })
    ro.observe(cv)
    return () => ro.disconnect()
  }, [redraw])

  // Met à jour la référence des formes (hors render) et redessine.
  useEffect(() => {
    shapesRef.current = shapes
    redraw()
  }, [shapes, redraw])

  useEffect(() => {
    if (!textDraft) return
    textInputRef.current?.focus()
    textInputRef.current?.select()
  }, [textDraft])

  function pointFromEvent(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }

  function handleDown(e) {
    if (tool === 'cursor') {
      onBackgroundClick?.()
      return
    }
    const p = pointFromEvent(e)
    onBeginAnnotation?.()
    if (tool === 'text') {
      setTextDraft({ at: p, value: '' })
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    draftRef.current =
      tool === 'pen'
        ? { tool: 'pen', color, points: [p] }
        : { tool, color, from: p, to: p }
    redraw()
  }

  function handleMove(e) {
    const p = pointFromEvent(e)
    onCursor?.(p.x, p.y)
    if (!draftRef.current) return
    if (draftRef.current.tool === 'pen') draftRef.current.points.push(p)
    else draftRef.current.to = p
    redraw()
  }

  function handleUp() {
    const draft = draftRef.current
    draftRef.current = null
    if (!draft) return
    // Ignore les gestes trop courts (clic accidentel).
    const valid =
      draft.tool === 'pen'
        ? draft.points.length > 1
        : Math.hypot(draft.to.x - draft.from.x, draft.to.y - draft.from.y) > 0.01
    if (valid) onAddShape?.(draft)
    redraw()
  }

  function commitTextDraft() {
    if (!textDraft) return
    const value = textDraft.value.trim()
    if (value) onAddShape?.({ tool: 'text', color, at: textDraft.at, value })
    setTextDraft(null)
  }

  function cancelTextDraft() {
    setTextDraft(null)
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`overlay-canvas${tool !== 'cursor' ? ' drawing' : ''}`}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      />
      {textDraft && (
        <input
          ref={textInputRef}
          className="text-draft-input"
          value={textDraft.value}
          style={{
            left: `${textDraft.at.x * 100}%`,
            top: `${textDraft.at.y * 100}%`,
            color,
          }}
          aria-label="Texte de l'annotation"
          onChange={(e) =>
            setTextDraft((draft) => (draft ? { ...draft, value: e.target.value } : draft))
          }
          onBlur={commitTextDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitTextDraft()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancelTextDraft()
            }
          }}
        />
      )}
    </>
  )
}
