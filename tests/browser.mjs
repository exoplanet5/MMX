import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'test-results'); await mkdir(out, { recursive: true });
const screenshots = process.argv.includes('--screenshots');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const errors = [], requests = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, reducedMotion: 'reduce' });
await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const ready = async () => { await page.waitForFunction(() => window.__mmx?.ready); await settle(); };
const shot = async name => { if (screenshots) await page.screenshot({ path: path.join(out, `${name}.png`) }); };
const norm = values => Math.hypot(...values);
const distance = (a, b) => norm(a.map((value, i) => value - b[i]));
const target = () => page.evaluate(() => window.__mmx.controls.target.toArray());
async function drag(button, dx, dy) {
  const box = await page.locator('#scene canvas').boundingBox();
  const x = box.x + box.width * .55, y = box.y + box.height * .55;
  await page.mouse.move(x, y); await page.mouse.down({ button });
  await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up({ button }); await settle();
}
let server;
try {
  await page.goto(pathToFileURL(path.join(root, 'docs/index.html')).href); await ready();
  assert.equal(await page.evaluate(() => window.__mmx.mode), 'departure');
  assert.equal(await page.evaluate(() => window.__mmx.state.view), 'departure');
  assert.equal(await page.locator('[data-view="departure"]').getAttribute('aria-pressed'), 'true');
  assert.equal(norm(await target()), 0);
  assert.equal(await page.evaluate(() => window.__mmx.sky.stars.geometry.attributes.position.count), 9827);
  assert.equal(await page.evaluate(() => window.__mmx.sky.grid.geometry.attributes.position.count), 8280);
  const gridLabels = await page.locator('.grid-label').allTextContents();
  assert.equal(gridLabels.length, 24 * 11);
  for (const hour of [1, 7, 13, 23]) assert.ok(gridLabels.includes(`${hour}h +15°`));
  assert.ok(await page.locator('.constellation-name').count() > 80);
  const checkTerminator = () => page.evaluate(() => {
    const app = window.__mmx, line = app.terminator;
    const sun = app.sample(app.state.t).sun, unit = app.meta.earth_radius_km;
    const s = line.position.clone().set(sun[0] / unit, sun[2] / unit, -sun[1] / unit);
    line.updateMatrixWorld(true);
    let radiusError = 0, horizonError = 0;
    for (let i = 0; i < line.geometry.attributes.instanceStart.count; i += 19) {
      const p = line.position.clone().fromBufferAttribute(line.geometry.attributes.instanceStart, i).applyMatrix4(line.matrixWorld).divideScalar(1.0002);
      radiusError = Math.max(radiusError, Math.abs(p.length() - 1));
      horizonError = Math.max(horizonError, Math.abs(p.dot(s.clone().sub(p))) / s.length());
    }
    return { radiusError, horizonError, depthTest: line.material.depthTest, independent: line.parent !== app.earth,
      color: line.material.color.getHexString(), orientation: line.quaternion.toArray() };
  });
  const initialTerminator = await checkTerminator();
  assert.ok(initialTerminator.radiusError < 1e-7);
  assert.ok(initialTerminator.horizonError < 1e-7);
  assert.ok(initialTerminator.depthTest && initialTerminator.independent);
  assert.equal(initialTerminator.color, 'b09025');
  // About lives at the foot of the right panel; Data, Copy view, About buttons, dialogs and the footer bar are gone.
  assert.equal(await page.locator('#show-data, #copy-link, #show-about, dialog, footer, #show-osculating, .legend-line.osculating').count(), 0);
  assert.ok((await page.locator('.topbar').boundingBox()).height <= 48, 'slim title bar');
  assert.ok(await page.locator('#scene .scene-credit').isVisible());
  assert.match(await page.locator('#scene .scene-credit').textContent(), /Illustration: Mickey/);
  await page.locator('#about-panel summary').click();
  const about = await page.locator('#about-panel').innerText();
  assert.match(about, /1 hour and 15°/);
  assert.ok(!/initially|hidden|removed|changelog|Sampling and provenance|dashed/i.test(about));
  await shot('earth-about');
  const downloadEvent = page.waitForEvent('download'); await page.click('#download-csv');
  await (await downloadEvent).saveAs(path.join(out, 'earth-download.csv'));
  assert.equal((await readFile(path.join(out, 'earth-download.csv'), 'utf8')).trim().split(/\r?\n/).length, 8642);
  await page.locator('#about-panel summary').click();
  assert.ok(!(await page.locator('#controls-panel').innerText()).includes('Click an Asian city'), 'no note under the sky-chart button');
  await shot('earth-default');
  assert.deepEqual(await page.locator('#state-panel h2').allTextContents(), ['Epoch · UTC', 'Geocentric state · ICRF', 'Osculating orbit · Earth']);
  // Desktop panel toggles: hiding the left column turns the time controls into a bottom bar.
  for (const [id, side] of [['#toggle-controls', 'left'], ['#toggle-info', 'right']]) {
    assert.equal(await page.locator(id).getAttribute('aria-pressed'), 'true');
    await page.click(id); await settle();
    assert.equal(await page.locator(`.side.${side}`).isVisible(), false, `${side} panel hides on desktop`);
    assert.equal(await page.locator(id).getAttribute('aria-pressed'), 'false');
  }
  const bar = await page.locator('.time-panel').boundingBox(), wide = await page.locator('#scene').boundingBox();
  assert.ok(bar.width > 1400 && bar.y > wide.y + wide.height - 2 && await page.locator('#timeline').isVisible(), 'time bar spans the bottom');
  assert.ok(wide.width > 1400, 'scene uses the full width');
  await page.click('#toggle-controls'); await page.click('#toggle-info'); await settle();
  assert.ok(await page.locator('.side.left').isVisible() && await page.locator('.side.right').isVisible());
  assert.ok((await page.locator('.time-panel').boundingBox()).width <= 245);
  // Time controls live in the left column; the timeline list, Jump-to-UTC form and bottom bar are gone.
  assert.equal(await page.locator('#events, #utc-input, #go-utc, section.timeline').count(), 0);
  const slider = await page.locator('#timeline').boundingBox(), panel = await page.locator('.time-panel').boundingBox();
  assert.ok(slider.x >= panel.x && slider.x + slider.width <= panel.x + panel.width && panel.x < 10 && panel.width <= 245);
  assert.match(await page.locator('#utc-clock').textContent(), /2026-10-19 21:00:00/);
  const [raBox, decBox] = [await page.locator('#ra-value').boundingBox(), await page.locator('#dec-value').boundingBox()];
  assert.ok(Math.abs(raBox.y - decBox.y) < 2 && decBox.x > raBox.x, 'RA and Dec share one line');
  const orbitCheck = await page.evaluate(() => ({ orbit: window.__mmx.orbit(), text: document.getElementById('orbit-e').textContent }));
  assert.ok(orbitCheck.orbit.e > 1 && Math.abs(orbitCheck.orbit.c3 - 9.959) < .001);
  assert.equal(orbitCheck.text, orbitCheck.orbit.e.toFixed(5));
  assert.equal(await page.locator('[data-view="xy"], [data-view="xz"], [data-view="yz"], #show-axes, #charts').count(), 0);
  assert.ok(!(await page.locator('body').innerText()).includes('Scientific figures'));
  assert.ok(!(await page.locator('body').innerText()).includes('flyby'));
  for (const id of ['show-moon', 'show-grid', 'show-stars', 'show-constellations']) assert.ok(await page.locator(`#${id}`).isChecked());
  assert.equal(await page.locator('#show-moon-orbit').isChecked(), false);
  assert.equal(await page.evaluate(() => window.__mmx.moonOrbit.visible), false);
  assert.equal(await page.evaluate(() => window.__mmx.moonOrbit.material.dashed), false);
  assert.ok((await page.locator('.grid-label:not([hidden])').allTextContents()).some(text => text.includes('h')));
  assert.ok(await page.locator('.star-name:not([hidden])').count() > 0);
  for (const button of ['left', 'right']) {
    const before = await page.evaluate(() => window.__mmx.camera.position.toArray());
    await drag(button, 65, 30);
    assert.equal(norm(await target()), 0, `${button} drag moved Earth pivot`);
    assert.ok(distance(before, await page.evaluate(() => window.__mmx.camera.position.toArray())) > 1);
  }
  await page.check('#show-moon-orbit'); await page.uncheck('#show-moon'); await settle();
  assert.equal(await page.evaluate(() => window.__mmx.moonOrbit.visible), true);
  assert.equal(await page.evaluate(() => window.__mmx.planets.moon.mesh.visible), false);
  await page.check('#show-moon'); await page.uncheck('#show-moon-orbit');
  await page.uncheck('#show-stars'); await settle();
  assert.equal(await page.evaluate(() => window.__mmx.sky.stars.visible), false);
  assert.equal(await page.evaluate(() => window.__mmx.sky.constellations.visible), true);
  await page.check('#show-stars');
  await page.uncheck('#show-constellations'); await settle();
  assert.equal(await page.locator('.constellation-name:not([hidden])').count(), 0);
  await page.check('#show-constellations');
  await page.click('#reset-camera');
  assert.equal(await page.evaluate(() => window.__mmx.state.view), 'departure');
  await page.click('#end');
  const finalTerminator = await checkTerminator();
  assert.ok(finalTerminator.radiusError < 1e-7 && finalTerminator.horizonError < 1e-7);
  assert.ok(distance(initialTerminator.orientation, finalTerminator.orientation) > 1e-3);
  assert.match(await page.locator('#utc-clock').textContent(), /2026-10-25 21:00:00/);
  const direction = await page.evaluate(() => {
    const s = window.__mmx.sample(window.__mmx.state.t);
    return { ra: s.ra_deg, dec: s.dec_deg, r: s.mmx.slice(0, 3) };
  });
  assert.ok(Math.abs(direction.ra - (Math.atan2(direction.r[1], direction.r[0]) * 180 / Math.PI + 360) % 360) < 1e-10);
  assert.ok(Math.abs(direction.dec - Math.atan2(direction.r[2], Math.hypot(...direction.r.slice(0, 2))) * 180 / Math.PI) < 1e-10);
  await page.locator('#timeline').fill('172800');
  await page.click('[data-view="full"]'); await settle();
  const bounds = await page.evaluate(() => window.__mmx.projectedBounds());
  assert.ok([...bounds.x, ...bounds.y].every(v => Math.abs(v) < .95));
  await shot('earth-desktop');
  await page.click('[data-view="departure"]'); await settle(); await shot('earth-detail');
  assert.equal(await page.evaluate(() => window.__mmx.state.t), 0);
  await page.click('#reset-camera');
  const nearDistance = norm(await page.evaluate(() => window.__mmx.camera.position.toArray()));
  await page.click('[data-view="full"]');
  assert.ok(norm(await page.evaluate(() => window.__mmx.camera.position.toArray())) > nearDistance * 10);
  await page.click('#reset-camera');
  assert.equal(await page.evaluate(() => window.__mmx.state.view), 'departure');
  // Ground sky chart: Asian city labels on the globe, globe clicks, field and all-sky views, pass chips and links.
  assert.equal(await page.locator('.place-label:not([hidden])').count(), 0, 'cities wait until Earth is large on screen');
  await page.click('[data-view="asia"]'); await settle(); await settle();
  const placeNames = await page.locator('.place-label:not([hidden])').allTextContents();
  for (const name of ['Tokyo', 'Beijing', 'Seoul', 'New Delhi', 'Singapore', 'Jakarta']) assert.ok(placeNames.includes(name), name);
  assert.ok(placeNames.length > 25 && await page.evaluate(() => window.__mmx.site.earthPixels > 230));
  await shot('earth-asia');
  await page.locator('.place-label', { hasText: /^Tokyo$/ }).click(); await settle(); await settle();
  let chart = await page.evaluate(() => window.__mmx.skyChart.state());
  assert.ok(chart.open && chart.site.id === 'tokyo' && chart.mode === 'field' && chart.fov === 20);
  assert.equal(await page.locator('.skc-tbtn.skc-on', { hasText: 'Field' }).count(), 1);
  assert.equal(chart.passes.length, 7);
  assert.equal(await page.locator('.skc-chip').count(), 8);
  assert.match(await page.locator('.skw-title .sub').textContent(), /Tokyo/);
  assert.match(await page.locator('.skc-foot').textContent(), /GMT\+9/);
  assert.ok(await page.evaluate(() => window.__mmx.site.marker.visible));
  const painted = () => page.evaluate(() => {
    const c = document.querySelector('.skw canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 450) lit++; return lit;
  });
  assert.ok(await painted() > 500, 'field chart draws stars and labels');
  await page.locator('.skc-chip[data-i="2"]').click(); await settle(); await settle();
  chart = await page.evaluate(() => window.__mmx.skyChart.state());
  const chip = chart.passes[2];
  assert.equal(await page.evaluate(() => window.__mmx.state.t), chip.best);
  assert.ok(chip.darkSeconds > 3 * 3600 && chart.look.el > 15, 'pre-dawn dark-sky pass from Tokyo');
  assert.ok(Math.abs(chart.center.ra - 137) < 4 && Math.abs(chart.center.dec - 22.4) < 3, 'field framed on MMX in Cancer');
  assert.ok(await page.evaluate(() => window.__mmx.site.sightLine.visible), 'line of sight drawn while MMX is up');
  await shot('sky-field');
  await page.locator('.skc-tbtn', { hasText: 'All-sky' }).click(); await settle();
  assert.equal(await page.evaluate(() => window.__mmx.skyChart.state().mode), 'allsky');
  assert.ok(await painted() > 500); await shot('sky-allsky');
  await page.locator('.skc-tbtn', { hasText: 'Field' }).click();
  await page.locator('.skc-tbtn', { hasText: '20°' }).click(); await settle();
  assert.equal(await page.evaluate(() => window.__mmx.skyChart.state().fov), 40);
  await page.keyboard.press('Escape'); await settle();
  assert.equal(await page.evaluate(() => window.__mmx.skyChart.state().open), false);
  assert.equal(await page.evaluate(() => window.__mmx.site.marker.visible), false);
  // With site labels hidden, a click resolves to the clicked globe point (labels within 14 px would otherwise win).
  await page.click('[data-view="asia"]'); await page.uncheck('#show-places'); await settle();
  const globe = await page.locator('#scene canvas').boundingBox();
  await page.mouse.click(globe.x + globe.width / 2, globe.y + globe.height / 2); await settle(); await settle();
  await page.check('#show-places');
  chart = await page.evaluate(() => window.__mmx.skyChart.state());
  assert.ok(chart.open && chart.site.custom && Math.abs(chart.site.lat - 30) < 1 && Math.abs(chart.site.lon - 108) < 1, `globe click site ${chart.site.lat}, ${chart.site.lon}`);
  assert.equal(norm(await target()), 0, 'a globe click must not move the Earth pivot');
  await page.selectOption('.skc-site', 'misasa'); await settle();
  assert.equal(await page.evaluate(() => window.__mmx.skyChart.state().site.heightKm), 1.58);
  await page.click('.skw-close'); await page.click('#reset-camera');
  await page.setViewportSize({ width: 390, height: 844 }); await settle();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.locator('#timeline').isVisible(), 'time slider stays reachable on phones');
  await page.evaluate(() => window.__mmx.openSky(window.__mmx.places.find(p => p.id === 'singapore'))); await settle();
  const sheet = await page.locator('.skw').boundingBox();
  assert.ok(sheet.x >= 15 && sheet.x + sheet.width <= 375 && sheet.y + sheet.height <= 844, 'sky chart fits the phone viewport');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await shot('sky-mobile'); await page.click('.skw-close');
  await shot('earth-mobile');

  await page.click('.page-switch a[href="./transfer.html"]'); await ready();
  assert.equal(await page.evaluate(() => window.__mmx.mode), 'transfer');
  assert.equal(norm(await target()), 0);
  assert.deepEqual(await page.locator('#state-panel h2').allTextContents(), ['Epoch · UTC', 'Heliocentric state · ICRF', 'Osculating orbit · Sun']);
  assert.equal(await page.locator('#events, #utc-input, #open-sky, #show-places').count(), 0);
  const helio = await page.evaluate(() => window.__mmx.orbit());
  assert.ok(helio.e < 1 && helio.inclination < 3);
  assert.equal(await page.evaluate(() => window.__mmx.meta.end_utc), '2027-08-29T04:57:00Z');
  assert.equal(await page.evaluate(() => window.__mmx.state.view), 'inner');
  assert.equal(await page.evaluate(() => window.__mmx.sky.stars.geometry.attributes.position.count), 9827);
  assert.equal(await page.evaluate(() => window.__mmx.sky.grid.geometry.attributes.position.count), 8280);
  assert.equal(await page.evaluate(() => window.__mmx.terminator === undefined), true);
  const mobileBounds = await page.evaluate(() => window.__mmx.projectedBounds());
  assert.ok([...mobileBounds.x, ...mobileBounds.y].every(v => Math.abs(v) < .95));
  await shot('transfer-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 }); await settle();
  const beforeSky = await page.evaluate(() => window.__mmx.sky.camera.quaternion.toArray());
  await drag('right', 80, 30);
  const panned = await target(); assert.ok(norm(panned) > .01);
  assert.deepEqual(await page.evaluate(() => window.__mmx.sky.camera.position.toArray()), [0, 0, 0]);
  assert.ok(distance(beforeSky, await page.evaluate(() => window.__mmx.sky.camera.quaternion.toArray())) < 1e-10, 'Pan must not move the stellar sphere');
  await drag('left', 55, -35);
  assert.ok(distance(panned, await target()) < 1e-10, 'Left drag must orbit the panned pivot');
  await page.click('#reset-camera'); assert.equal(norm(await target()), 0);
  assert.equal(await page.evaluate(() => window.__mmx.state.view), 'inner');
  for (const name of ['earth', 'mars', 'jupiter', 'saturn']) {
    assert.ok(await page.evaluate(name => window.__mmx.planets[name].mesh.visible, name));
    assert.ok(await page.evaluate(name => window.__mmx.orbits[name].visible, name));
  }
  await page.uncheck('#show-orbits'); await settle();
  assert.equal(await page.evaluate(() => window.__mmx.orbits.mars.visible), false);
  assert.equal(await page.evaluate(() => window.__mmx.planets.mars.mesh.visible), true);
  await page.check('#show-orbits');
  await page.locator('#timeline').fill(String(150 * 86400)); await settle(); await shot('transfer-desktop');
  await page.click('[data-view="outer"]'); await settle(); await shot('transfer-outer');
  await page.click('#end');
  assert.match(await page.locator('#utc-clock').textContent(), /2027-08-29 04:57:00/);
  assert.ok(await page.evaluate(() => window.__mmx.sample(window.__mmx.meta.duration_s).marsRange < 4000));
  await page.click('#start'); await page.click('#play');
  await page.waitForFunction(() => window.__mmx.state.t > 0); await page.click('#play');
  assert.equal(await page.evaluate(() => window.__mmx.state.playing), false);
  await page.locator('#about-panel summary').click();
  const transferDownload = page.waitForEvent('download'); await page.click('#download-csv');
  assert.equal((await transferDownload).suggestedFilename(), 'mmx_transfer.csv');
  await page.click('.page-switch a[href="./index.html"]'); await ready();
  assert.equal(await page.evaluate(() => window.__mmx.mode), 'departure');
  assert.deepEqual(requests, [], 'Both standalone viewers must load without network requests');
  assert.deepEqual(errors, [], 'No JavaScript or shader errors');
  console.log('PASS: offline linked pages, left-column time controls, desktop panel toggles, right-panel About, osculating elements, Earth-locked drag, Asian city and globe-click sky charts, solar free-pan pivot, layers, RA/Dec, transfer endpoints, playback, data export and desktop/mobile views.');

  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith('/MMX/')) { res.writeHead(404); res.end(); return; }
      const file = path.resolve(root, 'docs', pathname.slice(5) || 'index.html');
      if (!file.startsWith(path.join(root, 'docs') + path.sep)) throw new Error('Invalid path');
      const type = { '.html': 'text/html', '.json': 'application/json', '.csv': 'text/csv' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }); res.end(await readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/MMX/`;
  const httpContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const httpPage = await httpContext.newPage(); httpPage.on('pageerror', e => errors.push(e.message));
  await httpPage.goto(base + 'transfer.html?t=86400&view=inner&cam=3,4,6,0.2,0.3,0.1,0,1,0');
  await httpPage.waitForFunction(() => window.__mmx?.ready);
  await httpPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await httpPage.evaluate(() => window.__mmx.state.t), 86400);
  assert.ok(distance(await httpPage.evaluate(() => window.__mmx.controls.target.toArray()), [.2, .3, .1]) < 1e-10);
  await httpPage.goto(base + '?cam=400,280,600,-30,60,-45,0,1,0'); await httpPage.waitForFunction(() => window.__mmx?.ready);
  assert.deepEqual(await httpPage.evaluate(() => window.__mmx.controls.target.toArray()), [0, 0, 0], 'Restored Earth links must not bypass Earth lock');
  await httpPage.goto(base + '?t=86400&view=asia&sky=misasa'); await httpPage.waitForFunction(() => window.__mmx?.ready);
  const linked = await httpPage.evaluate(() => window.__mmx.skyChart.state());
  assert.ok(linked.open && linked.site.id === 'misasa' && await httpPage.evaluate(() => window.__mmx.state.view) === 'asia');
  await httpPage.goto(base + '?sky=13.7563,100.5018'); await httpPage.waitForFunction(() => window.__mmx?.ready);
  assert.ok(await httpPage.evaluate(() => window.__mmx.skyChart.state().site.custom));
  for (const suffix of ['', 'transfer.html', 'data/ephemeris.json', 'data/transfer.json', 'data/mmx_transfer.csv', 'data/transfer_provenance.json']) assert.equal((await httpContext.request.get(base + suffix)).status(), 200, suffix);
  const retinaContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const retinaPage = await retinaContext.newPage(); retinaPage.on('pageerror', e => errors.push(e.message));
  await retinaPage.goto(base); await retinaPage.waitForFunction(() => window.__mmx?.ready);
  await retinaPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await retinaPage.evaluate(() => window.__mmx.sky.starMaterial.uniforms.pixelRatio.value), 2);
  assert.deepEqual(await retinaPage.evaluate(() => Array.from(window.__mmx.sky.stars.geometry.attributes.appearance.array)),
    await page.evaluate(() => Array.from(window.__mmx.sky.stars.geometry.attributes.appearance.array)), 'Star diameters must remain in CSS pixels on Retina displays');
  await retinaContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS: HTTP /MMX/ paths, saved solar pivot, enforced Earth lock, near-Earth reset, 1h/15° grid, moving solar terminator, and Retina star sizing.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await browser.close();
}
