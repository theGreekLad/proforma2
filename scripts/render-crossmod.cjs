/**
 * Regenerate the CrossMod renderings shown on the Layouts page.
 *
 * Renders every model × view through web-3d/crossmod-render.html (the same
 * three.js models used by the Streetscape page) and writes JPEGs to
 * web-3d/public/building-assets/crossmod-renders/<model>-<view>.jpg.
 *
 * Requires Playwright with Chromium. Start the dev server first:
 *   npm --prefix web-3d run dev
 *   node scripts/render-crossmod.cjs [baseUrl] [width] [height] [model:view,...]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MODELS = ['hawthorne', 'aspen', 'belmont', 'keeneland', 'magnolia'];
const VIEWS = ['front', 'elevation', 'rear', 'aerial'];

(async () => {
  const [base = 'http://localhost:5173/crossmod-render.html', w = '2400', h = '1350', only] = process.argv.slice(2);
  const outDir = path.resolve(__dirname, '../web-3d/public/building-assets/crossmod-renders');
  fs.mkdirSync(outDir, { recursive: true });
  const jobs = only
    ? only.split(',').map((item) => item.split(':'))
    : MODELS.flatMap((model) => VIEWS.map((view) => [model, view]));

  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [model, view] of jobs) {
    const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
    const started = Date.now();
    await page.goto(`${base}?model=${model}&view=${view}&w=${w}&h=${h}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__render && window.__render.done, null, { timeout: 900000, polling: 2000 });
    const result = await page.evaluate(() => window.__render);
    await page.close();
    if (result.error) {
      console.error(`${model}:${view} failed: ${result.error}`);
      process.exitCode = 1;
      continue;
    }
    const file = path.join(outDir, `${model}-${view}.jpg`);
    fs.writeFileSync(file, Buffer.from(result.dataURL.split(',')[1], 'base64'));
    console.log(`${model}:${view} → ${path.relative(process.cwd(), file)} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
  await browser.close();
})();
