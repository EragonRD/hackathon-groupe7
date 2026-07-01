// Capture des ecrans reels de Poulpium pour le deck P1.
// Sorties -> docs/presentations/assets/*.png
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', 'assets')
const BASE = process.env.BASE || 'http://localhost:5175'

const shot = async (page, name) => {
  await page.screenshot({ path: path.join(OUT, name + '.png') })
  console.log('  saved', name + '.png')
}
const vis = (page, sel) => page.locator(sel + ':visible').first()

const run = async () => {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
  page.setDefaultTimeout(15000)

  // 1) LOGIN
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  // Champs pre-remplis dans la demo, mais on force pour etre sur.
  const user = page.locator('input').first()
  const pass = page.locator('input[type=password]')
  await user.fill('alice')
  await pass.fill('password')
  await page.waitForTimeout(400)
  await shot(page, '01-login')

  // 2) CATALOGUE
  await page.getByRole('button', { name: /Se connecter/i }).click()
  await page.waitForTimeout(2000)
  await shot(page, '02-catalogue')

  // 3) REVUE (flux protege pokedex) + annotation + commentaire
  await page.getByText('pokedex', { exact: false }).first().click()
  await page.waitForTimeout(3500) // laisser le flux HLS demarrer

  // seek ~40% via la timeline
  const tl = vis(page, '[aria-label="Progression de la vidéo"]')
  const tb = await tl.boundingBox()
  if (tb) await page.mouse.click(tb.x + tb.width * 0.4, tb.y + tb.height / 2)
  await page.waitForTimeout(1500)

  const stage = vis(page, '.stage-inner')
  const sb = await stage.boundingBox()
  const P = (fx, fy) => ({ x: sb.x + sb.width * fx, y: sb.y + sb.height * fy })

  // Fleche ambre
  await vis(page, '[aria-label="Flèche"]').click()
  await vis(page, '[aria-label="Couleur Ambre"]').click()
  let a = P(0.30, 0.62), b = P(0.62, 0.30)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up()
  await page.waitForTimeout(400)

  // Cadre cyan
  await vis(page, '[aria-label="Cadre"]').click()
  await vis(page, '[aria-label="Couleur Cyan"]').click()
  a = P(0.55, 0.12); b = P(0.9, 0.24)
  await page.mouse.move(a.x, a.y); await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up()
  await page.waitForTimeout(400)

  // Commentaire
  const ta = page.locator('textarea[placeholder^="Écrire un commentaire"]')
  await ta.fill('Le logo est trop petit ici, et le CTA manque de contraste. A agrandir avant la livraison.')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /^Commenter/ }).click()
  await page.waitForTimeout(1200)
  // Reselectionner la note pour reafficher les dessins sur l'image
  await page.getByText('Le logo est trop petit', { exact: false }).first().click()
  await page.waitForTimeout(800)
  await shot(page, '03-revue-annotation')

  // 4) ADMIN -> Contenus (revocation de cle)
  await page.getByRole('button', { name: /Administration/i }).first().click()
  await page.waitForTimeout(1500)
  const contenus = page.getByRole('button', { name: /^Contenus/ })
  if (await contenus.count()) { await contenus.first().click(); await page.waitForTimeout(1000) }
  await shot(page, '04-admin-contenus')

  // 5) SURVEILLANCE
  await page.getByRole('button', { name: /Surveillance/i }).first().click()
  await page.waitForTimeout(2000)
  await shot(page, '05-surveillance')

  await browser.close()
  console.log('DONE')
}

run().catch((e) => { console.error('CAPTURE ERROR', e); process.exit(1) })
