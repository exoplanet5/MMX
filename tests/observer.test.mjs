import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sample } from '../web/states.js';
import * as O from '../web/observer.js';
import { PLACES } from '../web/places.js';
const data = JSON.parse(readFileSync(new URL('../docs/data/ephemeris.json', import.meta.url)));
const fixtures = JSON.parse(readFileSync(new URL('./observer_fixtures.json', import.meta.url))).records;
const norm = v => Math.hypot(...v);
const difference = (a, b) => norm(a.map((x, i) => x - b[i]));
const angle = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const siteAt = (record, seconds) => {
  const s = sample(data, seconds);
  return O.orientSite(O.siteFrame(record.lat, record.lon, record.height_km), O.quaternionAt(data, s.i, s.u));
};

test('WGS84 sites rotate into ICRF exactly as Skyfield places them', () => {
  for (const record of fixtures) {
    const site = siteAt(record, record.seconds);
    assert.ok(difference(site.position, record.position_km) < 1e-6, `${record.site} position at ${record.seconds}s`);
    for (const axis of ['east', 'north', 'up']) assert.ok(difference(site[axis], record[axis]) < 1e-10, `${record.site} ${axis}`);
  }
});

test('MMX and Sun look angles, range and topocentric RA/Dec agree with the independent reference', () => {
  let checked = 0;
  for (const record of fixtures.filter(r => r.mmx)) {
    const site = siteAt(record, record.seconds), i = record.seconds / 60;
    for (const body of ['mmx', 'sun']) {
      const look = O.topocentric(site, data.states[body][i]), expected = record[body];
      assert.ok(Math.abs(look.range - expected.range_km) < 1e-6 * Math.max(1, expected.range_km / 1e5));
      assert.ok(angle(look.az, expected.az_deg) < 1e-8 && Math.abs(look.el - expected.el_deg) < 1e-8, `${record.site} ${body} az/el`);
      assert.ok(angle(look.ra_deg, expected.ra_deg) < 1e-8 && Math.abs(look.dec_deg - expected.dec_deg) < 1e-8);
    }
    assert.ok(angle(record.mmx.az_deg, record.mmx.skyfield_az_deg) < 1e-9);
    checked++;
  }
  assert.equal(checked, 40);
});

test('horizontal conversion round-trips and the local axes are right-handed', () => {
  const site = siteAt({ lat: 36.1333, lon: 138.35, height_km: 1.58 }, 12345);
  assert.ok(difference(O.fromHorizontal(site, 0, 90), site.up) < 1e-12);
  for (const [az, el] of [[0, 0], [90, 15], [225, 45], [359, -10]]) {
    const back = O.horizontal(site, O.fromHorizontal(site, az, el));
    assert.ok(angle(back.az, az) < 1e-9 && Math.abs(back.el - el) < 1e-9);
  }
  const e = site.east, n = site.north, cross = [e[1] * n[2] - e[2] * n[1], e[2] * n[0] - e[0] * n[2], e[0] * n[1] - e[1] * n[0]];
  assert.ok(difference(cross, site.up) < 1e-12);
});

test('passes start and end on the geometric horizon and include dark-sky time', () => {
  const frame = O.siteFrame(36.1333, 138.35, 1.58), track = O.siteTrack(data, frame);
  const passes = O.findPasses(data.elapsed_s, track);
  assert.ok(passes.length >= 6 && passes.length <= 8);
  for (const pass of passes) {
    assert.ok(pass.los > pass.aos && pass.maxEl > 0 && pass.maxEl <= 90);
    for (const [t, edge] of [[pass.aos, pass.startsBefore], [pass.los, pass.endsAfter]]) {
      if (edge) continue;
      const s = sample(data, t), look = O.topocentric(O.orientSite(frame, O.quaternionAt(data, s.i, s.u)), s.mmx);
      assert.ok(Math.abs(look.el) < .02, `horizon crossing at ${t}: ${look.el}`);
    }
    if (pass.best !== null) assert.ok(pass.darkSeconds > 0 && pass.best >= pass.aos && pass.best <= pass.los);
  }
  assert.ok(passes.some(pass => pass.darkSeconds > 3 * 3600), 'Misasa has multi-hour dark-sky visibility');
  // A fixed direction at Dec +22° stays above a 36°N horizon for 2 × 107.1° of hour angle, about 14.2 hours.
  const late = passes.filter(pass => pass.aos > 2 * 86400 && !pass.endsAfter);
  assert.ok(late.length >= 3 && late.every(pass => Math.abs((pass.los - pass.aos) / 3600 - 14.2) < .3), 'late passes behave like a star at Dec +22°');
});

test('MMX departs inside Earth’s shadow and emerges into sunlight', () => {
  const lit = data.states.mmx.map((state, i) => O.sunlitFraction(state, data.states.sun[i]));
  assert.equal(lit[0], 0);
  const exit = lit.findIndex(value => value === 1);
  assert.ok(exit > 0 && exit < 60, `shadow exit sample ${exit}`);
  assert.ok(lit.slice(exit).every(value => value === 1));
  assert.equal(O.sunlitFraction([0, 0, 7000], [1.5e8, 0, 0]), 1);
  assert.equal(O.sunlitFraction([-7000, 0, 0], [1.5e8, 0, 0]), 0);
});

test('gnomonic tangent plane is centered, conformal at the center and maps great circles to lines', () => {
  const center = O.radecVector(135, 22), frame = O.tangentFrame(center);
  assert.ok(O.gnomonic(frame, center).slice(0, 2).every(v => Math.abs(v) < 1e-12));
  const north = O.gnomonic(frame, O.radecVector(135, 32));
  assert.ok(Math.abs(north[0]) < 1e-12 && Math.abs(north[1] - Math.tan(10 * Math.PI / 180)) < 1e-12);
  const east = O.gnomonic(frame, O.radecVector(136, 22));
  assert.ok(east[0] > 0 && Math.abs(east[1]) < .01, 'increasing RA is +ξ');
  const a = O.radecVector(130, 18), b = O.radecVector(141, 27), pa = O.gnomonic(frame, a), pb = O.gnomonic(frame, b);
  for (let f = .1; f < 1; f += .2) {
    const m = a.map((x, k) => x * (1 - f) + b[k] * f), p = O.gnomonic(frame, m.map(x => x / norm(m)));
    const area = (pb[0] - pa[0]) * (p[1] - pa[1]) - (pb[1] - pa[1]) * (p[0] - pa[0]);
    assert.ok(Math.abs(area) < 1e-12);
  }
  const back = O.fromGnomonic(frame, .1, -.2), p = O.gnomonic(frame, back);
  assert.ok(Math.abs(p[0] - .1) < 1e-12 && Math.abs(p[1] + .2) < 1e-12);
  assert.ok(O.gnomonic(frame, center.map(v => -v)) === null);
});

test('place catalog: unique ids, valid coordinates, time zones and JAXA facilities', () => {
  assert.equal(new Set(PLACES.map(p => p.id)).size, PLACES.length);
  assert.ok(PLACES.length >= 70);
  for (const p of PLACES) {
    assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && [1, 2, 3].includes(p.tier), p.name);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-GB', { timeZone: p.tz }), p.tz);
  }
  const misasa = PLACES.find(p => p.id === 'misasa');
  assert.equal(misasa.kind, 'station'); assert.equal(misasa.heightKm, 1.58);
  assert.deepEqual(PLACES.filter(p => p.kind === 'station').map(p => p.id), ['misasa', 'uchinoura', 'tanegashima']);
});
