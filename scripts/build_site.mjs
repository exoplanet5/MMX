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
const datum = (label, id, value, unit = '', kind = '') => `<div class="datum${kind ? ' ' + kind : ''}"><dt>${label}</dt><dd><span id="${id}">${value}</span>${unit ? `<small>${unit}</small>` : ''}</dd></div>`;
const block = (title, rows, note = '') => `<section class="metric"><h2>${title}</h2><dl class="data-list">${rows}</dl>${note}</section>`;
const num = (value, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const dateLabel = utc => new Date(utc).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }).replace(',', '');

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
      : '<button class="active" data-view="departure">Near-Earth detail</button><button data-view="full">Full six-day trajectory</button><button data-view="asia">Asia ground view</button>',
    CAMERA_HINT: transfer ? 'Left-drag to orbit · scroll to zoom.<br>Right-drag to pan; subsequent orbiting uses the new pivot.'
      : 'Left- or right-drag to orbit Earth.<br>Scroll or pinch to zoom. The pivot stays at Earth’s center.',
    RESET_LABEL: transfer ? 'Reset to Sun' : 'Reset to Earth',
    BODY_LAYERS: transfer ? checkbox('show-planets', 'Planets') + checkbox('show-orbits', 'Planet orbits')
      : checkbox('show-moon', 'Moon') + checkbox('show-moon-orbit', 'Lunar orbit / path', false) + checkbox('show-places', 'Asian cities &amp; JAXA sites'),
    ORBIT_LAYER: checkbox('show-osculating', transfer ? 'Osculating heliocentric orbit' : 'Osculating geocentric orbit'),
    ORBIT_LEGEND: transfer ? 'Planet reference orbits' : 'Lunar path · optional',
    TERMINATOR_LEGEND: transfer ? '' : '<div><i class="legend-line terminator"></i>Day–night terminator</div>',
    GROUND_SECTION: transfer ? '' : '<section class="section"><h2>Ground sky chart</h2><button id="open-sky">✶ Open sky chart</button><p class="fine">Use the Asia ground view, then click a city, a JAXA station or any point on Earth. The chart frames MMX’s part of the sky with the local horizon.</p></section>',
    OSCULATING_LEGEND: transfer ? 'Osculating heliocentric orbit' : 'Osculating geocentric orbit',
    START_UTC: meta.start_utc, START_DATE: meta.start_utc.slice(0, 10), START_TIME: meta.start_utc.slice(11, 19),
    START_DISPLAY: meta.start_utc.replace('T', ' ').replace('Z', ''), START_LABEL: dateLabel(meta.start_utc), END_LABEL: dateLabel(meta.end_utc), DURATION: String(meta.duration_s),
    SCENE_LABEL: transfer ? 'Interactive heliocentric Mars transfer' : 'Interactive Earth-centered inertial departure',
    SCENE_HEADING: transfer ? 'Sun-centered · Earth to Mars' : 'Earth-centered · 19–25 October 2026',
    SCENE_SUBTITLE: transfer ? 'Heliocentric ICRF · distances in AU · stellar reference at infinity' : 'Earth-locked camera · geometric ICRF · stellar reference at infinity',
    SCENE_HINT: transfer ? 'Sun at the camera pivot · zoom out for Jupiter and Saturn.' : 'Earth is always the camera pivot.',
    RIGHT_PANEL: transfer
      ? block('Heliocentric state · ICRF', datum('Sun distance', 'helio-value', num(data.metrics.heliocentric_range_km[0] / meta.au_km, 5), 'AU', 'hero wide')
          + datum('Heliocentric speed', 'speed-value', num(data.metrics.speed_km_s[0], 3), 'km/s', 'wide')
          + datum('Earth range', 'range-value', num(data.metrics.earth_range_km[0], 0), 'km', 'wide'))
        + block('Osculating orbit · Sun', datum('Semimajor axis', 'orbit-a', '—', 'AU') + datum('Eccentricity', 'orbit-e', '—')
          + datum('Perihelion', 'orbit-peri', '—', 'AU') + datum('Aphelion', 'orbit-apo', '—', 'AU')
          + datum('Inclination', 'orbit-i', '—', '° ecl.') + datum('Period', 'orbit-period', '—', 'days'),
          '<p class="fine">Two-body Sun conic through the selected state, J2000 ecliptic inclination. Planetary perturbations alter it slowly.</p>')
      : block('Geocentric state · ICRF', datum('Earth range', 'range-value', num(data.metrics.earth_range_km[0], 3), 'km', 'hero wide')
          + datum('Geocentric speed', 'speed-value', num(data.metrics.speed_km_s[0], 3), 'km/s', 'wide')
          + '<div class="datum wide"><dt>RA · Dec · geometric</dt><dd class="radec"><span id="ra-value">—</span>  <span id="dec-value">—</span></dd></div>')
        + block('Osculating orbit · Earth', datum('C3', 'orbit-c3', '—', 'km²/s²') + datum('v∞', 'orbit-vinf', '—', 'km/s')
          + datum('Eccentricity', 'orbit-e', '—') + datum('Inclination', 'orbit-i', '—', '° eq.')
          + datum('Perigee radius', 'orbit-peri', '—', 'km') + datum('Perigee altitude', 'orbit-alt', '—', 'km'),
          '<p class="fine">Two-body Earth conic through the selected state; Sun and Moon perturbations alter it over the window.</p>'),
    PLAYBACK_SPEEDS: speeds.map(([value, text]) => `<option value="${value}"${value === (transfer ? 86400 : 3600) ? ' selected' : ''}>${text}</option>`).join(''),
    TABLE_NOTE: transfer ? 'Heliocentric distance and speed; Earth-center range. Sampling is denser near departure and arrival.' : 'Geometric Earth-centered ICRF. Positions sampled every 60 seconds; RA/Dec derive from the Cartesian vectors.',
    TABLE_HEAD: (transfer ? ['UTC', 'Sun range AU', 'Speed km/s', 'Earth range km'] : ['UTC', 'Earth range km', 'Speed km/s', 'RA', 'Dec']).map(text => `<th>${text}</th>`).join(''),
    ABOUT_CONTENT: transfer
      ? '<p>Explore MMX’s Sun-centered cruise from 19 October 2026 21:00 UTC to 29 August 2027 04:57 UTC, with Earth, Mars, Jupiter and Saturn for context. The final epoch precedes a discontinuity in the planning ephemeris; it is not an official insertion time.</p><p>Positions and speeds are geometric ICRF states. Planet paths span one nominal orbit; Mars, Jupiter and Saturn use their system barycenters. Left-drag orbits the current pivot, right-drag pans, and Reset to Sun restores the Earth–Mars view.</p><p>The dashed ellipse is the osculating Sun two-body orbit through the selected state; the right panel lists its elements, with inclination referred to the J2000 ecliptic.</p>'
      : '<p>Explore MMX’s Earth-centered departure from 19 October 2026 21:00 UTC to 25 October 2026 21:00 UTC. The near-Earth view frames the first three hours; the full view covers all six days. Both drag buttons orbit Earth.</p><p>Range, speed and RA/Dec describe the geometric Earth-to-MMX state in ICRF. The yellow surface line marks the geometric day–night terminator at the selected UTC, without atmospheric refraction. Earth’s geography rotates beneath the inertial trajectory. The dashed hyperbola is the osculating Earth two-body orbit through the selected state, drawn from perigee outward; the right panel lists its elements.</p><p><strong>Ground sky charts.</strong> Click an Asian city, a JAXA station or any point on Earth. MMX recedes from 8,700 km to 1.8 million km, so after the first hours it moves less than a degree per hour against the stars while the sky turns 15° per hour. The default field is therefore a partial-sky gnomonic RA/Dec chart framed on the selected pass, showing MMX’s topocentric track, its daily parallax wobble, the stars, the horizon and a 15° elevation line. An all-sky alt-az view is also available. Pass chips give rise and set times; dark-sky time requires MMX sunlit, at least 15° high, with the Sun below −12°. Directions are geometric, without refraction or light-time; brightness is not predicted. City positions are approximate centres.</p>',
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
