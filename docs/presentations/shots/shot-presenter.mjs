import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', 'assets')
const BASE = process.env.BASE || 'http://localhost:5180'

const b = await chromium.launch({ headless: false })
const page = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 3 })
page.setDefaultTimeout(20000)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.locator('input').first().fill('alice')
await page.locator('input[type=password]').fill('password')
await page.getByRole('button', { name: /Se connecter/i }).click()
await page.waitForTimeout(2000)
await page.getByText('pokedex', { exact: false }).first().click()
await page.waitForTimeout(3500)
// Prendre la presentation -> le bouton passe a "Vous presentez . Arreter" (accent)
await page.getByRole('button', { name: /^Présenter/ }).click()
await page.waitForTimeout(900)
const row = page.locator('.controls-row').first()
await row.screenshot({ path: path.join(OUT, '06-presenter.png') })
console.log('saved 06-presenter.png')
await b.close()
