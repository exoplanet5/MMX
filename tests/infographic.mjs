import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
const requests = [], errors = [];
await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(pathToFileURL(path.join(root, 'docs/infographics/index.html')).href);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('svg').count(), 1);
  assert.equal(await page.locator('[data-tip]').count(), 4);
  assert.equal(await page.locator('.sources li').count(), 10);
  assert.equal(await page.locator('.record tbody tr').count(), 8);
  const clipped = await page.locator('.plate svg').evaluate(svg => {
    const { width, height } = svg.viewBox.baseVal;
    return [...svg.querySelectorAll('text')].flatMap(t => { const b=t.getBBox(); return b.x < 0 || b.y < 0 || b.x+b.width > width || b.y+b.height > height ? [t.textContent] : []; });
  });
  assert.deepEqual(clipped, []);
  await page.locator('[data-tip]').first().focus();
  assert.ok(await page.locator('#tip').isVisible());
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#tip').isVisible(), false);
  await page.screenshot({ path: path.join(root, 'test-results/infographic-page-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const name of ['journey', 'phobos', 'probe', 'samples', 'corer', 'pneumatic', 'full']) {
    await page.click(`#view-${name}`);
    assert.equal(await page.locator(`#view-${name}`).getAttribute('aria-pressed'), 'true');
    const box = await page.locator('.plate svg').boundingBox();
    assert.ok(box.width <= 360 && box.height > 60);
  }
  await page.click('#view-pneumatic');
  await page.screenshot({ path: path.join(root, 'test-results/infographic-page-mobile.png'), fullPage: true });
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  console.log('PASS: standalone infographic, unclipped figure text, accessible contextual tooltips, all seven region crops, source table, and phone-width layout. No runtime network requests.');
} finally { await browser.close(); }
