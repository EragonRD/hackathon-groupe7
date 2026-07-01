// Captures distinctes (slides 4,5,7) — purge d'abord les notes existantes.
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', 'assets')
const BASE = process.env.BASE || 'http://localhost:5180'

const b = await chromium.launch({ headless: false })
const page = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
page.setDefaultTimeout(20000)
const vis = s => page.locator(s + ':visible').first()

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.locator('input').first().fill('alice')
await page.locator('input[type=password]').fill('password')
await page.getByRole('button', { name: /Se connecter/i }).click()
await page.waitForTimeout(2000)
await page.getByText('pokedex', { exact: false }).first().click()
await page.waitForTimeout(3800)

// --- PURGE : supprimer toutes les notes existantes (donnees de demo/junk)
for (let k = 0; k < 30; k++) {
  const del = page.locator('[aria-label="Supprimer le commentaire"]').filter({ has: page.locator(':visible') })
  const btn = page.locator('[aria-label="Supprimer le commentaire"]:visible').first()
  if ((await btn.count()) === 0) break
  await btn.click().catch(() => {})
  await page.waitForTimeout(250)
}
await page.waitForTimeout(500)
console.log('purge done')

const seek = async (frac) => {
  const tl = vis('[aria-label="Progression de la vidéo"]')
  const tb = await tl.boundingBox()
  await page.mouse.click(tb.x + tb.width * frac, tb.y + tb.height / 2)
  await page.waitForTimeout(1200)
}
const drag = async (fx, fy, tx, ty) => {
  const s = await vis('.stage-inner').boundingBox()
  await page.mouse.move(s.x + s.width * fx, s.y + s.height * fy)
  await page.mouse.down()
  await page.mouse.move(s.x + s.width * tx, s.y + s.height * ty, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(300)
}
const comment = async (txt) => {
  await page.locator('textarea[placeholder^="Écrire un commentaire"]').fill(txt)
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /^Commenter/ }).click()
  await page.waitForTimeout(900)
}

// A @ home
await seek(0.40)
await vis('[aria-label="Flèche"]').click()
await vis('[aria-label="Couleur Ambre"]').click()
await drag(0.30, 0.60, 0.60, 0.34)
await comment('Le logo d accueil est trop petit.')

// B @ autre frame -> capture 04
await seek(0.62)
await vis('[aria-label="Ellipse"]').click()
await vis('[aria-label="Couleur Violet"]').click()
await drag(0.40, 0.30, 0.66, 0.58)
await comment('Element peu lisible ici, a revoir.')
await page.getByText('peu lisible ici', { exact: false }).first().click()
await page.waitForTimeout(700)
await page.screenshot({ path: path.join(OUT, '04-annotation-b.png') })
console.log('saved 04-annotation-b.png')

// C @ autre frame
await seek(0.78)
await vis('[aria-label="Cadre"]').click()
await vis('[aria-label="Couleur Cyan"]').click()
await drag(0.34, 0.68, 0.64, 0.86)
await comment('Aligner les icones de la barre du bas.')

// Resoudre A, repondre a B
try {
  const cardA = page.locator('.comment-wrap').filter({ hasText: 'logo d accueil' }).first()
  await cardA.locator('[aria-label="Marquer résolu"]').click()
  await page.waitForTimeout(600)
} catch (e) { console.log('resolve A skip', e.message) }
try {
  const cardB = page.locator('.comment-wrap').filter({ hasText: 'peu lisible ici' }).first()
  await cardB.locator('[title="Répondre"]').first().click()
  await page.waitForTimeout(400)
  await page.locator('textarea[placeholder^="Écrire une réponse"]').first().fill('Corrige sur la maquette v2, a valider.')
  await page.waitForTimeout(200)
  await cardB.getByRole('button', { name: /^Répondre$/ }).last().click()
  await page.waitForTimeout(700)
} catch (e) { console.log('reply B skip', e.message) }

// Frame propre pour 05 + deselection des dessins
await seek(0.40)
try { await page.locator('.comment-list').click({ position: { x: 6, y: 6 } }) } catch {}
await page.waitForTimeout(500)
await page.screenshot({ path: path.join(OUT, '05-comments.png') })
console.log('saved 05-comments.png')

await b.close()
