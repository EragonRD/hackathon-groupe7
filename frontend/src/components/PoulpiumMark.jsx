import { useEffect, useId, useRef } from 'react'

// Marque Poulpium — poulpe stylisé (mark géométrique simple).
// `animated`     : ondulation des tentacules + flottement (login).
// `interactive`  : les yeux suivent le curseur (login).
// Réutilisé dans la topbar (petit) et le login (grand).
export default function PoulpiumMark({
  size = 28,
  animated = false,
  interactive = false,
}) {
  // id de gradient unique par instance (évite les collisions SVG).
  // useId peut contenir des ':' -> on les retire pour rester valide en url(#...).
  const gid = `poulp${useId().replace(/:/g, '')}`

  const svgRef = useRef(null)
  const eyeLRef = useRef(null)
  const eyeRRef = useRef(null)

  // Les pupilles glissent vers le curseur (écriture DOM directe, aucun re-render).
  useEffect(() => {
    if (!interactive) return
    function onMove(e) {
      const svg = svgRef.current
      if (!svg) return
      const r = svg.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height * 0.4 // les yeux sont en haut de la tête
      const ang = Math.atan2(e.clientY - cy, e.clientX - cx)
      // amplitude bornée pour que les pupilles restent dans la tête
      const reach = Math.min(1.4, Math.hypot(e.clientX - cx, e.clientY - cy) / 45)
      const t = `translate(${Math.cos(ang) * reach} ${Math.sin(ang) * reach})`
      eyeLRef.current?.setAttribute('transform', t)
      eyeRRef.current?.setAttribute('transform', t)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [interactive])

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Poulpium"
      className={animated ? 'poulpium-mark anim' : 'poulpium-mark'}
    >
      <defs>
        <linearGradient
          id={gid}
          x1="6"
          y1="3"
          x2="26"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5b85ff" />
          <stop offset="0.55" stopColor="#3d6dfd" />
          <stop offset="1" stopColor="#29c5e6" />
        </linearGradient>
      </defs>

      {/* tentacules */}
      <g stroke={`url(#${gid})`} strokeWidth="2.1" strokeLinecap="round" fill="none">
        <path className="tnt t1" d="M9 17 Q6.5 23 8.5 28.5" />
        <path className="tnt t2" d="M12.7 19 Q11.5 25 12.5 30" />
        <path className="tnt t3" d="M16 19.5 Q16 26 16 31" />
        <path className="tnt t4" d="M19.3 19 Q20.5 25 19.5 30" />
        <path className="tnt t5" d="M23 17 Q25.5 23 23.5 28.5" />
      </g>

      {/* tête */}
      <circle cx="16" cy="12" r="8.4" fill={`url(#${gid})`} />

      {/* yeux (groupés pour suivre le curseur) */}
      <g ref={eyeLRef} style={{ transition: 'transform 0.12s ease-out' }}>
        <circle cx="12.8" cy="12" r="1.7" fill="#0a0c0f" />
        <circle cx="13.3" cy="11.4" r="0.5" fill="#fff" />
      </g>
      <g ref={eyeRRef} style={{ transition: 'transform 0.12s ease-out' }}>
        <circle cx="19.2" cy="12" r="1.7" fill="#0a0c0f" />
        <circle cx="19.7" cy="11.4" r="0.5" fill="#fff" />
      </g>
    </svg>
  )
}
