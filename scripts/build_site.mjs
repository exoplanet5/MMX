import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'web/vendor/three');
const result = await build({
  entryPoints: [path.join(root, 'web/app.js')], bundle: true, write: false, format: 'iife',
  target: ['es2022'], minify: true, legalComments: 'inline',
  plugins: [{ name: 'local-three', setup(builder) {
    builder.onResolve({ filter: /^three$/ }, () => ({ path: path.join(vendor, 'three.module.min.js') }));
    builder.onResolve({ filter: /^three\/addons\// }, args => ({ path: path.join(vendor, args.path.slice(6)) }));
  } }],
});
const [template, stellarReference, image, threeLicense, referenceLicense, celestialLicense, hipparcosRaw] = await Promise.all([
  readFile(path.join(root, 'web/index.template.html'), 'utf8'), readFile(path.join(root, 'web/assets/stars.json'), 'utf8'),
  readFile(path.join(root, 'web/assets/earth_day.jpg')), readFile(path.join(vendor, 'LICENSE'), 'utf8'),
  readFile(path.join(root, 'web/vendor/STARSHIP_LICENSE'), 'utf8'), readFile(path.join(root, 'web/vendor/CELESTIAL_LICENSE'), 'utf8'),
  readFile(path.join(root, 'web/assets/hipparcos.json'), 'utf8'),
]);
const reference = JSON.parse(stellarReference), hipparcos = JSON.parse(hipparcosRaw);
const stellar = JSON.stringify({ stars: hipparcos.stars, names: reference.names, cons: reference.cons, lines: reference.lines,
  meta: { stars: hipparcos.meta, overlays: reference.meta } });
const license = `/* Three.js r170\n${threeLicense}\nStarship IFT-14 / SatObserver-MX reference patterns\n${referenceLicense}\nStellar catalog derived from d3-celestial\n${celestialLicense}\n*/\n`;
const script = (license + result.outputFiles[0].text).replaceAll('</script', '<\\/script');
const checkbox = (id, label, checked = true) => `<label class="check"><input id="${id}" type="checkbox"${checked ? ' checked' : ''}> ${label}</label>`;
const metric = (id, label, value, unit, extra = '', angle = false) => `<section class="metric"><h2>${label}</h2><div class="stat-value${angle ? ' angle' : ''}" id="${id}">${value}</div><div class="stat-unit">${unit}</div>${extra}</section>`;
const num = (value, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const dateLabel = utc => new Date(utc).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }).replace(',', ' ·') + ' UTC';

for (const transfer of [false, true]) {
  const raw = await readFile(path.join(root, `docs/data/${transfer ? 'transfer' : 'ephemeris'}.json`), 'utf8');
  const data = JSON.parse(raw), meta = data.meta;
  const title = transfer ? 'MMX Mars Transfer' : 'MMX Earth Departure';
  const speeds = transfer ? [[3600, '1 hour / s'], [21600, '6 hours / s'], [86400, '1 day / s'], [604800, '1 week / s']]
    : [[60, '1 min / s'], [600, '10 min / s'], [3600, '1 hour / s'], [14400, '4 hours / s']];
  const fields = {
    TITLE: title, PAGE_NAME: transfer ? 'Mars transfer' : 'Earth departure',
    DESCRIPTION: transfer ? 'MMX heliocentric Earth-to-Mars planning trajectory, October 2026 to August 2027, with planetary orbits and an inertial stellar background.' : 'MMX Earth-centered departure, 19–25 October 2026, with geometric RA/Dec, catalog stars and constellations.',
    EARTH_ACTIVE: transfer ? '' : 'active', TRANSFER_ACTIVE: transfer ? 'active' : '',
    CAMERA_BUTTONS: transfer ? '<button class="active" data-view="inner">Earth–Mars scale</button><button data-view="outer">Jupiter &amp; Saturn scale</button>'
      : '<button class="active" data-view="departure">Near-Earth detail</button><button data-view="full">Full six-day trajectory</button>',
    CAMERA_HINT: transfer ? 'Left-drag to orbit · scroll to zoom.<br>Right-drag to pan; subsequent orbiting uses the new pivot.'
      : 'Left- or right-drag to orbit Earth.<br>Scroll or pinch to zoom. The pivot stays at Earth’s center.',
    RESET_LABEL: transfer ? 'Reset to Sun' : 'Reset to Earth',
    BODY_LAYERS: transfer ? checkbox('show-planets', 'Planets') + checkbox('show-orbits', 'Planet orbits')
      : checkbox('show-moon', 'Moon') + checkbox('show-moon-orbit', 'Lunar orbit / path', false),
    ORBIT_LEGEND: transfer ? 'Planet reference orbits' : 'Lunar path · optional',
    TERMINATOR_LEGEND: transfer ? '' : '<div><i class="legend-line terminator"></i>Day–night terminator</div>',
    EVENT_HEADING: transfer ? 'Transfer timeline' : 'Departure timeline',
    EVENT_NOTE: transfer ? 'Geometry milestones from the planning arc. The final state precedes a model splice; it is not an official insertion time.' : 'Planning states, 19–25 October 2026. Elapsed time is measured from this window’s start.',
    START_INPUT: meta.start_utc.slice(0, 19), END_INPUT: meta.end_utc.slice(0, 19),
    START_DISPLAY: meta.start_utc.replace('T', ' ').replace('Z', ''), START_LABEL: dateLabel(meta.start_utc), END_LABEL: dateLabel(meta.end_utc), DURATION: String(meta.duration_s),
    SCENE_LABEL: transfer ? 'Interactive heliocentric Mars transfer' : 'Interactive Earth-centered inertial departure',
    SCENE_HEADING: transfer ? 'Sun-centered · Earth to Mars' : 'Earth-centered · 19–25 October 2026',
    SCENE_SUBTITLE: transfer ? 'Heliocentric ICRF · distances in AU · stellar reference at infinity' : 'Earth-locked camera · geometric ICRF · stellar reference at infinity',
    SCENE_HINT: transfer ? 'Sun at the camera pivot · zoom out for Jupiter and Saturn.' : 'Earth is always the camera pivot.',
    RIGHT_PANEL: transfer
      ? metric('helio-value', 'Heliocentric distance', num(data.metrics.heliocentric_range_km[0] / meta.au_km, 5), 'AU', `<p class="stat-unit" id="helio-km">${num(data.metrics.heliocentric_range_km[0])} km from the Sun</p>`)
        + metric('speed-value', 'Heliocentric speed', num(data.metrics.speed_km_s[0], 3), 'km/s · geometric inertial velocity')
        + metric('range-value', 'Earth range', num(data.metrics.earth_range_km[0], 3), 'km from Earth’s center')
      : metric('range-value', 'Earth range', num(data.metrics.earth_range_km[0], 3), 'km from Earth’s center')
        + metric('speed-value', 'Geocentric speed', num(data.metrics.speed_km_s[0], 3), 'km/s · geometric inertial velocity')
        + metric('ra-value', 'Geocentric right ascension', '—', 'ICRF · geometric · hours', '', true)
        + metric('dec-value', 'Geocentric declination', '—', 'ICRF · geometric · degrees', '', true),
    PLAYBACK_SPEEDS: speeds.map(([value, text]) => `<option value="${value}"${value === (transfer ? 86400 : 3600) ? ' selected' : ''}>${text}</option>`).join(''),
    TABLE_NOTE: transfer ? 'Heliocentric distance and speed; Earth-center range. Sampling is denser near departure and arrival.' : 'Geometric Earth-centered ICRF. Positions sampled every 60 seconds; RA/Dec derive from the Cartesian vectors.',
    TABLE_HEAD: (transfer ? ['UTC', 'Sun range AU', 'Speed km/s', 'Earth range km'] : ['UTC', 'Earth range km', 'Speed km/s', 'RA', 'Dec']).map(text => `<th>${text}</th>`).join(''),
    ABOUT_CONTENT: transfer
      ? '<p>Explore MMX’s Sun-centered cruise from 19 October 2026 21:00 UTC to 29 August 2027 04:57 UTC, with Earth, Mars, Jupiter and Saturn for context. The final epoch precedes a discontinuity in the planning ephemeris; it is not an official insertion time.</p><p>Positions and speeds are geometric ICRF states. Planet paths span one nominal orbit; Mars, Jupiter and Saturn use their system barycenters. Left-drag orbits the current pivot, right-drag pans, and Reset to Sun restores the Earth–Mars view.</p>'
      : '<p>Explore MMX’s Earth-centered departure from 19 October 2026 21:00 UTC to 25 October 2026 21:00 UTC. The near-Earth view frames the first three hours; the full view covers all six days. Both drag buttons orbit Earth.</p><p>Range, speed and RA/Dec describe the geometric Earth-to-MMX state in ICRF. The yellow surface line marks the geometric day–night terminator at the selected UTC, without atmospheric refraction. Earth’s geography rotates beneath the inertial trajectory.</p>',
    CSV_FILE: transfer ? 'mmx_transfer.csv' : 'mmx_eci.csv',
    EPHEMERIS_JSON: raw.replaceAll('<', '\\u003c'), STELLAR_JSON: stellar.replaceAll('<', '\\u003c'),
    EARTH_TEXTURE: 'data:image/jpeg;base64,' + image.toString('base64'), APP_SCRIPT: script,
  };
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in fields)) throw new Error(`Unknown template field: ${key}`); return fields[key];
  }).replace(/[\t ]+$/gm, '');
  await mkdir(path.join(root, 'docs'), { recursive: true });
  const filename = transfer ? 'transfer.html' : 'index.html';
  await writeFile(path.join(root, 'docs', filename), html);
  console.log(`Built standalone docs/${filename}: ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MiB.`);
}
await writeFile(path.join(root, 'docs/.nojekyll'), '');
