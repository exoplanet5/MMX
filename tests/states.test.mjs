import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sample, sceneVector, csvText, utcAt } from '../web/states.js';
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
