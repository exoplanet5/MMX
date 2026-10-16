import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sample, sceneVector, csvText, utcAt, equatorial, solarTerminator } from '../web/states.js';
import { SKY_STYLE, starAppearance } from '../web/sky-style.js';
const data = JSON.parse(readFileSync(new URL('../docs/data/ephemeris.json', import.meta.url)));
const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)));
const norm = v => Math.hypot(...v);
const difference = (a, b) => norm(a.map((x, i) => x - b[i]));

test('UTC interval, inclusive endpoints and clamping', () => {
  assert.equal(data.elapsed_s.length, 8641);
  assert.equal(utcAt(data, 0), '2026-10-19T21:00:00Z');
  assert.equal(utcAt(data, 518400), '2026-10-25T21:00:00Z');
  assert.deepEqual(sample(data, -1).mmx, data.states.mmx[0]);
  assert.deepEqual(sample(data, 518401).mmx, data.states.mmx.at(-1));
  assert.deepEqual(sample(data, NaN).mmx, data.states.mmx[0]);
});

test('every native sample is reproduced', () => {
  for (let i = 0; i < data.elapsed_s.length; i++) {
    assert.ok(difference(sample(data, data.elapsed_s[i]).mmx, data.states.mmx[i]) < 1e-8);
  }
});

test('Hermite implementation agrees with Python; errors meet reported validation', () => {
  for (const fixture of fixtures.samples) {
    const s = sample(data, fixture.seconds);
    assert.ok(difference(s.mmx, fixture.interpolated_mmx) < 1e-6);
    assert.ok(difference(s.mmx.slice(0, 3), fixture.horizons_mmx.slice(0, 3)) < .005282);
    assert.ok(difference(s.mmx.slice(3), fixture.horizons_mmx.slice(3)) < .002234);
    assert.ok(difference(s.moon.slice(0, 3), fixture.moon_state.slice(0, 3)) < .00001);
    assert.ok(Math.abs(s.earthRange - norm(s.mmx.slice(0, 3))) < 1e-9);
    assert.ok(Math.abs(s.speed - norm(s.mmx.slice(3))) < 1e-12);
    assert.ok(Math.abs(s.moonDistance - difference(s.mmx.slice(0, 3), s.moon.slice(0, 3))) < 1e-9);
  }
});

test('display rotation is right-handed and norm preserving', () => {
  assert.deepEqual(sceneVector([1, 2, 3], 1), [1, 3, -2]);
  const ex = sceneVector([1, 0, 0], 1), ey = sceneVector([0, 1, 0], 1), ez = sceneVector([0, 0, 1], 1);
  const cross = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
  assert.equal(difference(cross, ez), 0);
  assert.equal(norm(sceneVector([3, 4, 12], 1)), 13);
});

test('geographical directions map through the baked quaternion correctly', () => {
  for (const f of fixtures.orientation) {
    const [x, y, z, w] = data.earth_quaternion_xyzw[f.index];
    const a = f.local_scene;
    const t = [2 * (y * a[2] - z * a[1]), 2 * (z * a[0] - x * a[2]), 2 * (x * a[1] - y * a[0])];
    const actual = [a[0] + w * t[0] + y * t[2] - z * t[1], a[1] + w * t[1] + z * t[0] - x * t[2], a[2] + w * t[2] + x * t[1] - y * t[0]];
    assert.ok(difference(actual, f.inertial_scene) < 1e-12, f.name);
  }
});

test('CSV download preserves all canonical samples and precision', () => {
  const rows = csvText(data).trim().split('\r\n');
  assert.equal(rows.length, 8642);
  assert.ok(rows[1].startsWith('2026-10-19T21:00:00Z,0,'));
  assert.ok(rows.at(-1).startsWith('2026-10-25T21:00:00Z,518400,'));
  assert.equal(Number(rows[1].split(',')[2]), data.states.mmx[0][0]);
});

test('geocentric RA/Dec have correct quadrants and polar limits', () => {
  for (const [vector, ra, dec] of [[[1, 0, 0], 0, 0], [[0, 1, 0], 90, 0], [[-1, 0, 0], 180, 0], [[0, -1, 0], 270, 0], [[1, 0, 1], 0, 45], [[0, 0, -1], 0, -90]]) {
    const actual = equatorial(vector);
    assert.ok(Math.abs(actual.ra_deg - ra) < 1e-12);
    assert.ok(Math.abs(actual.dec_deg - dec) < 1e-12);
  }
  for (const t of [0, 86400, 518400]) {
    const s = sample(data, t);
    const expected = equatorial(s.mmx);
    assert.equal(s.ra_deg, expected.ra_deg); assert.equal(s.dec_deg, expected.dec_deg);
  }
});

test('Roman star styling converts marker area to diameter and preserves magnitude order', () => {
  let previous = starAppearance(-1.5);
  for (const magnitude of [0, 1, 1.59, 1.6, 3, 4.6, 5.5, 6.59]) {
    const style = starAppearance(magnitude);
    assert.ok(style.diameter < previous.diameter);
    assert.ok(style.opacity <= previous.opacity);
    assert.equal(style.opacity, Math.max(.25, Math.min(1, .25 + .115 * (6.6 - magnitude))));
    assert.ok(style.diameter >= .65 && style.opacity >= .25 && style.opacity <= 1);
    if (magnitude < 1.6) assert.ok(style.ringDiameter > style.diameter);
    else assert.equal(style.ringDiameter, 0);
    if (magnitude < 6) assert.ok(Math.abs((style.diameter * 72 / 96) ** 2 - .55 * (6.9 - magnitude) ** 2.3) < 1e-12);
    previous = style;
  }
  assert.equal(SKY_STYLE.raStepDegrees, 15);
  assert.equal(SKY_STYLE.decStepDegrees, 15);
});

test('solar terminator lies on the globe at the finite-distance geometric horizon', () => {
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = a => a.map(x => x / norm(a));
  for (const [sun, radius] of [[[0, 0, 10], 1], [[0, 0, -10], 1], [[10, 0, 0], 1],
    ...[0, 43210, 518400].map(t => [sample(data, t).sun, data.meta.earth_radius_km])]) {
    const b = solarTerminator(sun, radius);
    const a = normalize(cross(b.normal, Math.abs(b.normal[0]) < .9 ? [1, 0, 0] : [0, 1, 0]));
    const c = cross(b.normal, a);
    for (let i = 0; i < 36; i++) {
      const angle = i * Math.PI / 18;
      const p = b.center.map((x, k) => x + b.radius * (a[k] * Math.cos(angle) + c[k] * Math.sin(angle)));
      assert.ok(Math.abs(norm(p) / radius - 1) < 1e-14);
      assert.ok(Math.abs(dot(p, sun.slice(0, 3).map((x, k) => x - p[k]))) / (radius * norm(sun.slice(0, 3))) < 1e-14);
    }
  }
  assert.throws(() => solarTerminator([0, 0, 0], 1), RangeError);
  assert.throws(() => solarTerminator([1, 0, 0], 1), RangeError);
});

const transfer = JSON.parse(readFileSync(new URL('../docs/data/transfer.json', import.meta.url)));
const transferFixtures = JSON.parse(readFileSync(new URL('./transfer_fixtures.json', import.meta.url)));

test('transfer uses irregular sampling and ends before the arrival splice', () => {
  assert.equal(transfer.meta.center_id, 10);
  assert.equal(transfer.meta.step_s, null);
  assert.equal(transfer.meta.end_utc, '2027-08-29T04:57:00Z');
  assert.equal(transfer.meta.samples, 8503);
  assert.equal(transfer.summary.validation.midpoint_count, 8502);
  const steps = new Set(transfer.elapsed_s.slice(1).map((t, i) => t - transfer.elapsed_s[i]));
  assert.deepEqual([...steps].sort((a, b) => a - b), [60, 300, 3600]);
  assert.deepEqual(sample(transfer, Infinity).mmx, transfer.states.mmx[0]);
  assert.deepEqual(sample(transfer, transfer.meta.duration_s + 1000).mmx, transfer.states.mmx.at(-1));
  assert.ok(transfer.summary.arrival_boundary.velocity_integration_discrepancy_km > 8000);
});

test('all transfer native states and midpoint fixtures retain their frame and velocity', () => {
  for (let i = 0; i < transfer.elapsed_s.length; i++) assert.ok(difference(sample(transfer, transfer.elapsed_s[i]).mmx, transfer.states.mmx[i]) < 1e-6);
  for (const f of transferFixtures) {
    const s = sample(transfer, f.seconds);
    assert.ok(difference(s.mmx, f.interpolated_mmx) < 1e-5);
    assert.ok(difference(s.mmx.slice(0, 3), f.horizons_mmx.slice(0, 3)) < 1.477);
    assert.ok(difference(s.mmx.slice(3), f.horizons_mmx.slice(3)) < .006);
    assert.ok(difference(s.earth.slice(0, 3), f.earth.slice(0, 3)) < .01);
    assert.ok(difference(s.mars.slice(0, 3), f.mars.slice(0, 3)) < .01);
    assert.equal(s.heliocentricRange, norm(s.mmx.slice(0, 3)));
    assert.ok(Math.abs(s.earthRange - difference(s.mmx.slice(0, 3), s.earth.slice(0, 3))) < 1e-7);
  }
});

test('transfer context includes outer planets, complete reference tracks and correct exports', () => {
  for (const name of ['earth', 'mars', 'jupiter', 'saturn']) {
    assert.equal(transfer.states[name].length, 8503);
    assert.equal(transfer.orbits[name].position_km.length, 721);
  }
  assert.ok(norm(transfer.states.jupiter[0].slice(0, 3)) / transfer.meta.au_km > 4);
  assert.ok(norm(transfer.states.saturn[0].slice(0, 3)) / transfer.meta.au_km > 8);
  const rows = csvText(transfer).trim().split('\r\n');
  assert.equal(rows.length, 8504);
  assert.ok(rows[0].includes('heliocentric_range_km'));
  assert.ok(rows.at(-1).startsWith('2027-08-29T04:57:00Z,'));
});
