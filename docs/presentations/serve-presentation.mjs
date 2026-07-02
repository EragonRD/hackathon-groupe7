#!/usr/bin/env node
/*
 * serve-presentation.mjs — Serveur de présentation Poulpium (soutenance)
 * ---------------------------------------------------------------------------
 * Sert le dossier docs/presentations/ en HTTP et ouvre le navigateur sur un
 * index listant tous les decks. Fonctionne à l'identique sur Windows, macOS et
 * Linux : aucune dépendance externe (modules Node natifs uniquement).
 *
 *   node docs/presentations/serve-presentation.mjs            # port 8090
 *   node docs/presentations/serve-presentation.mjs --port 9000
 *   node docs/presentations/serve-presentation.mjs --no-open  # sans navigateur
 *
 * Pourquoi un serveur HTTP (et pas un double-clic sur le .html) ?
 *   - La slide « dashboard » du deck principal charge le dashboard Streamlit
 *     dans une iframe : en file://, certains navigateurs bloquent l'iframe et
 *     les chemins relatifs. En http://, tout fonctionne.
 *   - Permet d'afficher la présentation depuis un autre poste du LAN.
 * ---------------------------------------------------------------------------
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { networkInterfaces } from 'node:os'
import { spawn } from 'node:child_process'

// Dossier servi = celui de CE script (marche quel que soit le cwd).
const ROOT = fileURLToPath(new URL('.', import.meta.url))

// --- Arguments -------------------------------------------------------------
const argv = process.argv.slice(2)
const getFlag = (name) => argv.includes(name)
const getOpt = (name, def) => {
  const i = argv.indexOf(name)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def
}
const PORT = parseInt(process.env.PORT || getOpt('--port', '8090'), 10)
const OPEN = !getFlag('--no-open')

// --- Catalogue des présentations (ordre = ordre d'affichage) ---------------
const DECKS = [
  {
    file: 'Poulpium-Soutenance.html',
    title: 'Soutenance Poulpium (deck principal)',
    desc: 'Présentation complète et fusionnée : garde + équipe + P1 + P2 + P3 + dashboard + bonus + prod + démo.',
    primary: true,
  },
  {
    file: 'Page-de-Garde-Groupe7.html',
    title: "Page de garde — l'équipe",
    desc: 'Trombinoscope des 15 membres par pôle (View / Core / Engine).',
  },
  {
    file: 'P1-Frontend-Soutenance.html',
    title: 'Pôle 1 — View (Frontend React)',
    desc: 'Lecteur de revue augmenté, annotation, temps réel, Watch Together.',
  },
  {
    file: 'P2-Backend-Soutenance.html',
    title: 'Pôle 2 — Core (Backend NestJS)',
    desc: 'Zero-Trust (clé AES éphémère), anti-abus, audit & scans grype/trivy.',
  },
  {
    file: 'P3-IA-Soutenance.html',
    title: 'Pôle 3 — Engine (IA & Data)',
    desc: 'Pipeline NLP (transcription, résumé, chapitres), rétention & prévision.',
  },
  {
    file: 'William-Deploiement.html',
    title: 'Déploiement & Production',
    desc: 'Cloudflare Tunnel, docker compose + GHCR, Watchtower.',
  },
]

// --- Types MIME (statique, offline) ----------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.md': 'text/plain; charset=utf-8',
}

// Page d'index : liste cliquable des présentations disponibles.
function indexPage() {
  const cards = DECKS.map(
    (d) => `
    <a class="card${d.primary ? ' primary' : ''}" href="/${encodeURIComponent(d.file)}">
      <div class="t">${d.title}${d.primary ? ' <span class="pill">principal</span>' : ''}</div>
      <div class="d">${d.desc}</div>
      <div class="f">${d.file}</div>
    </a>`,
  ).join('')
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Présentations — Poulpium · Groupe 7</title>
  <style>
    :root{color-scheme:dark}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0c0f;color:#e9ebef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      min-height:100vh;padding:clamp(20px,4vw,56px);letter-spacing:-.01em}
    .wrap{max-width:960px;margin:0 auto}
    h1{font-size:clamp(24px,3.4vw,40px);font-weight:800;letter-spacing:-.03em}
    .sub{color:#9aa2ae;margin-top:8px;margin-bottom:clamp(20px,3vw,36px);font-size:14px}
    .grid{display:grid;gap:14px}
    .card{display:block;text-decoration:none;color:inherit;padding:18px 20px;border-radius:12px;
      background:#12151c;border:1px solid rgba(255,255,255,.08);transition:border-color .15s,transform .15s}
    .card:hover{border-color:rgba(61,109,253,.55);transform:translateY(-2px)}
    .card.primary{border-color:rgba(61,109,253,.45);background:linear-gradient(180deg,rgba(61,109,253,.10),#12151c)}
    .t{font-size:16px;font-weight:700}
    .pill{font-size:11px;font-weight:700;color:#fff;background:#3d6dfd;padding:2px 9px;border-radius:999px;vertical-align:middle;margin-left:6px}
    .d{color:#9aa2ae;font-size:13px;margin-top:6px;line-height:1.45}
    .f{color:#5d646f;font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:11.5px;margin-top:10px}
    .foot{color:#5d646f;font-size:12px;margin-top:28px;font-family:"SFMono-Regular",Consolas,Menlo,monospace}
  </style></head><body><div class="wrap">
    <h1>Présentations — Poulpium</h1>
    <div class="sub">Groupe 7 · Hackathon ESTIAM. Cliquez un deck pour l'ouvrir. Navigation : flèches ← / →.</div>
    <div class="grid">${cards}</div>
    <div class="foot">Astuce : pour le deck principal, lancez d'abord le dashboard Engine
    (<code>streamlit run dashboard/app.py</code>) pour la slide interactive.</div>
  </div></body></html>`
}

// Ouvre l'URL dans le navigateur par défaut (Windows / macOS / Linux).
function openBrowser(url) {
  const platform = process.platform
  let cmd, args
  if (platform === 'darwin') {
    cmd = 'open'
    args = [url]
  } else if (platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '', url] // le "" = titre vide requis par start
  } else {
    cmd = 'xdg-open'
    args = [url]
  }
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref()
  } catch {
    /* pas de navigateur dispo (headless) : on ignore, l'URL est affichée */
  }
}

// IP LAN (pour montrer la présentation depuis un autre poste).
function lanIPs() {
  const out = []
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address)
    }
  }
  return out
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    let pathname = decodeURIComponent(url.pathname)

    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(indexPage())
      return
    }

    // Anti path-traversal : on résout et on vérifie qu'on reste sous ROOT.
    const filePath = resolve(ROOT, '.' + normalize(pathname))
    if (!filePath.startsWith(resolve(ROOT))) {
      res.writeHead(403).end('Forbidden')
      return
    }

    const info = await stat(filePath).catch(() => null)
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<p>404 — introuvable. <a href="/">Retour à l\'index</a></p>')
      return
    }

    const body = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch (e) {
    res.writeHead(500).end('Erreur serveur : ' + e.message)
  }
})

server.listen(PORT, () => {
  const bar = '─'.repeat(52)
  console.log(`\n  ${bar}`)
  console.log('  Présentations Poulpium — serveur démarré')
  console.log(`  ${bar}`)
  console.log(`  Local :   http://localhost:${PORT}/`)
  for (const ip of lanIPs()) console.log(`  Réseau :  http://${ip}:${PORT}/  (autres postes du LAN)`)
  console.log(`  ${bar}`)
  console.log('  Ctrl+C pour arrêter.\n')
  if (OPEN) openBrowser(`http://localhost:${PORT}/`)
})

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} déjà utilisé. Relancez avec un autre port :`)
    console.error(`     node docs/presentations/serve-presentation.mjs --port ${PORT + 1}\n`)
  } else {
    console.error('  Erreur serveur :', e.message)
  }
  process.exit(1)
})
