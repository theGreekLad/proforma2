/**
 * Regenerate the CrossMod renderings shown on the Layouts page from the
 * Streetscape house models.
 *
 *   npm run dev            # in another terminal (or pass --url)
 *   node scripts/render-crossmod-layouts.mjs [--url http://localhost:5173] [--only hawthorne] [--out dir]
 *
 * Writes public/building-assets/crossmod-<id>-rendering.jpg (1280 × 720).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Plain require so a globally installed Playwright is found too.
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const url = opt('url', 'http://localhost:5173');
const only = opt('only', null);
const outDir = path.resolve(opt('out', path.join(here, '../public/building-assets')));
const ids = (only ? only.split(',') : ['hawthorne', 'aspen', 'belmont', 'keeneland', 'magnolia']);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.error('[page]', msg.text()); });
page.on('pageerror', (err) => console.error('[page]', err.message));
await page.goto(`${url}/layouts.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.__renderDesign === 'function');

fs.mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const t = Date.now();
  const dataUrl = await page.evaluate((modelId) => window.__renderDesign({ modelId }), id);
  const file = path.join(outDir, `crossmod-${id}-rendering.jpg`);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`${id}: ${file} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
await browser.close();
