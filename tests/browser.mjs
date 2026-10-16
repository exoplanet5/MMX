import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'test-results'); await mkdir(out, { recursive: true });
const screenshots = process.env.MMX_SCREENSHOTS !== '0';
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [], requests = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
let server;
try {
  await page.goto(pathToFileURL(path.join(root, 'docs/index.html')).href);
  await page.waitForFunction(() => window.__mmx?.ready);
  await settle();
  assert.equal(await page.evaluate(() => window.__mmx.state.t), 0);
  assert.match(await page.locator('#utc-clock').textContent(), /2026-10-19 21:00:00/);
  const bounds = await page.evaluate(() => window.__mmx.projectedBounds());
  assert.ok(bounds.x.every(v => Math.abs(v) < .95) && bounds.y.every(v => Math.abs(v) < .95), JSON.stringify(bounds));
  await page.click('#end');
  assert.equal(await page.evaluate(() => window.__mmx.state.t), 518400);
  assert.match(await page.locator('#utc-clock').textContent(), /2026-10-25 21:00:00/);
  assert.ok(Math.abs(await page.evaluate(() => window.__mmx.sample(518400).earthRange) - 1776012.2548105323) < 1e-6);
  await page.click('#previous-day');
  assert.equal(await page.evaluate(() => window.__mmx.state.t), 432000);
  await page.locator('#timeline').fill('120030');
  assert.equal(await page.evaluate(() => window.__mmx.state.t), 120030);
  await page.click('#play');
  await page.waitForFunction(() => window.__mmx.state.t > 120030);
  await page.click('#play');
  assert.equal(await page.evaluate(() => window.__mmx.state.playing), false);
  for (const view of ['xy', 'xz', 'yz', 'full']) {
    await page.click(`[data-view="${view}"]`);
    assert.equal(await page.evaluate(() => window.__mmx.state.view), view);
  }
  await page.click('#show-data');
  assert.equal(await page.locator('#data-rows tr').count(), 7);
  await page.selectOption('#table-step', '1');
  assert.equal(await page.locator('#data-rows tr').count(), 100);
  await page.click('#table-next');
  assert.match(await page.locator('#table-page').textContent(), /^2 \/ 87/);
  const downloadEvent = page.waitForEvent('download');
  await page.click('#download-csv');
  const download = await downloadEvent;
  await download.saveAs(path.join(out, 'download.csv'));
  const csv = await readFile(path.join(out, 'download.csv'), 'utf8');
  assert.equal(csv.trim().split(/\r?\n/).length, 8642);
  await page.click('#close-data');
  await page.locator('#utc-input').fill('2026-10-21T21:00'); await page.click('#go-utc');
  assert.equal(await page.evaluate(() => window.__mmx.state.t), 172800);
  await settle(); if (screenshots) await page.screenshot({ path: path.join(out, 'desktop.png') });
  await page.click('[data-view="departure"]');
  assert.equal(await page.evaluate(() => window.__mmx.state.t), 0);
  await settle(); if (screenshots) await page.screenshot({ path: path.join(out, 'departure.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__mmx.fitCamera('full'));
  await settle();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const mobileBounds = await page.evaluate(() => window.__mmx.projectedBounds());
  assert.ok(mobileBounds.x.every(v => Math.abs(v) < .95) && mobileBounds.y.every(v => Math.abs(v) < .95));
  if (screenshots) await page.screenshot({ path: path.join(out, 'mobile.png') });
  await page.click('#toggle-controls');
  assert.ok(await page.locator('#controls-panel').isVisible());
  await page.click('[data-view="xz"]'); await page.click('#close-controls');
  await page.click('#toggle-info'); assert.ok(await page.locator('#range-value').isVisible()); await page.click('#close-info');
  assert.deepEqual(requests, [], 'Standalone page must not request network resources');
  assert.deepEqual(errors, [], 'Browser must have no console/page errors');
  console.log('PASS: offline file, WebGL, camera fit, endpoints, interpolation readouts, timeline, playback, plane views, table, CSV, mobile controls; no network or JS errors.');

  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith('/MMX/')) { res.writeHead(404); res.end(); return; }
      const relative = pathname.slice(5) || 'index.html';
      const file = path.resolve(root, 'docs', relative);
      if (!file.startsWith(path.join(root, 'docs') + path.sep)) throw new Error('Invalid path');
      const content = await readFile(file);
      const type = { '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.csv': 'text/csv' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }); res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/MMX/`;
  const httpContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const httpPage = await httpContext.newPage();
  httpPage.on('pageerror', e => errors.push(e.message));
  await httpPage.goto(base + '?t=86400&view=xy&cam=400,280,600,-30,60,-45,0,1,0');
  await httpPage.waitForFunction(() => window.__mmx?.ready);
  await httpPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const restored = await httpPage.evaluate(() => window.__mmx.camera.position.toArray());
  assert.ok(Math.hypot(...restored.map((v, i) => v - [400, 280, 600][i])) < 1e-7, JSON.stringify(restored));
  assert.equal(await httpPage.evaluate(() => window.__mmx.state.t), 86400);
  assert.equal(await httpPage.evaluate(() => window.__mmx.state.view), 'xy');
  for (const suffix of ['data/ephemeris.json', 'data/mmx_eci.csv', 'plots/01_eci_overview.png', 'plots/02_eci_3d.png', 'plots/03_departure_zoom.png', 'plots/04_range_speed.png']) {
    const response = await httpContext.request.get(base + suffix); assert.equal(response.status(), 200, suffix);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: HTTP project-subpath hosting, URL time/view restoration and all downloadable data/figure URLs.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await browser.close();
}
