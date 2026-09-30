// Shoots each .scene in mockups.html to assets/images/loader/<id>.jpg.
//   cd tools && node mockups/render.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', '..', 'assets', 'images', 'loader');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, 'mockups.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
for (const el of await page.$$('.scene')) {
  const id = await el.getAttribute('id');
  await el.screenshot({ path: path.join(out, `${id}.jpg`), type: 'jpeg', quality: 82 });
  console.log(id);
}
await browser.close();
