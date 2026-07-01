import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '..', 'assets')
const BASE = process.env.BASE || 'http://localhost:5175'

const b = await chromium.launch({ headless: false })
const page = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
page.setDefaultTimeout(15000)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.locator('input').first().fill('alice')
await page.locator('input[type=password]').fill('password')
await page.getByRole('button', { name: /Se connecter/i }).click()
await page.waitForTimeout(2000)
await page.getByRole('button', { name: /Administration/i }).first().click()
await page.waitForTimeout(1500)
await page.getByRole('tab', { name: /Contenus/ }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(OUT, '04-admin-contenus.png') })
console.log('saved 04-admin-contenus.png')
await b.close()
