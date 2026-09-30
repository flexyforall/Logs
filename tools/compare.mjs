// Screenshots the live Webflow site and the local copy at the same scroll
// positions, side by side, so the two can be diffed by eye or by pixel.
//
//   node compare.mjs                      # both, desktop + mobile
//   node compare.mjs --only local         # just the copy
//   node compare.mjs --width 1440 --steps 0,800,1600
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map((s) => s.trim().split(/\s+/)).map(([k, v]) => [k, v ?? true]),
);

const SITES = {
  live: 'https://logs-flexy.webflow.io/' + (args.page ? args.page.replace('.html', '') : ''),
  local: pathToFileURL(path.join(here, '..', args.page || 'index.html')).href,
};
const sites = args.only ? { [args.only]: SITES[args.only] } : SITES;
const widths = args.width ? [+args.width] : [1440, 375];
const out = path.join(here, 'shots');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

for (const width of widths) {
  const height = width < 600 ? 812 : 900;
  for (const [name, url] of Object.entries(sites)) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', (e) => console.log(`[${name}] pageerror:`, e.message));
    page.on('console', (m) => m.type() === 'error' && console.log(`[${name}] console:`, m.text()));
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const steps = args.steps
      ? String(args.steps).split(',').map(Number)
      : Array.from({ length: Math.ceil(total / height) }, (_, i) => i * height);
    console.log(`${name} @${width}: page height ${total}`);
    for (const y of steps) {
      // Walk there rather than jump, so once-only scroll triggers fire on the way.
      await page.evaluate(async (target) => {
        const step = 200;
        let y = window.scrollY;
        while (Math.abs(target - y) > step) {
          y += Math.sign(target - y) * step;
          window.lenis ? window.lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        }
        window.lenis ? window.lenis.scrollTo(target, { immediate: true }) : window.scrollTo(0, target);
      }, y);
      await page.waitForTimeout(+(args.wait ?? 2200));
      const file = `${width}-${String(y).padStart(5, '0')}-${name}.png`;
      await page.screenshot({ path: path.join(out, file) });
    }
    await page.close();
  }
}
await browser.close();
console.log('shots in', out);
