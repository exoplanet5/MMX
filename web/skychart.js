// Ground-observer sky chart, after the SatObserver-MX window and the CZ-6A launch charts.
// The default view is a partial-sky field. After the first hours MMX barely moves against the stars while the whole
// sky turns with Earth, so an all-sky alt-az track mostly repeats a star's diurnal arc. A star-fixed gnomonic RA/Dec
// field shows MMX's real motion, its daily parallax wobble and the local horizon; the all-sky view stays as a locator.
import { sample } from './states.js';
import { starAppearance } from './sky-style.js';
import * as O from './observer.js';
import { PLACES } from './places.js';

const MONO = 'Menlo, "SF Mono", ui-monospace, Consolas, monospace';
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const FOVS = [5, 10, 20, 40, 80, 'auto'], TICKS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600];
const C = { ink: '#e8eaed', dim: 'rgba(154,164,174,0.9)', halo: 'rgba(5,8,12,0.85)', track: '#3987e5', pass: '#a1d4fc', sun: '#ffd54f',
  lines: 'rgba(90,123,184,0.6)', grid: 'rgba(130,160,210,0.2)', gridInk: 'rgba(154,164,174,0.75)', ground: 'rgba(4,6,9,0.78)' };
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const dir16 = az => COMPASS[Math.round(az / 22.5) % 16];
const pad = n => String(n).padStart(2, '0');
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = a => { const n = Math.hypot(...a); return a.map(v => v / n); };
const fmtLL = (lat, lon) => `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function hms(ra) { const s = Math.round(ra / 15 * 3600) % 86400; return `${pad(Math.floor(s / 3600))}h ${pad(Math.floor(s / 60) % 60)}m ${pad(s % 60)}s`; }
function dms(dec) { const s = Math.round(Math.abs(dec) * 60); return `${dec < 0 ? '−' : '+'}${pad(Math.floor(s / 60))}° ${pad(s % 60)}′`; }
// Sky-disc shade by twilight stage (discrete SatObserver-MX palette).
const skyBg = sunEl => sunEl >= 0 ? '#1e3348' : sunEl >= -6 ? '#182a3c' : sunEl >= -12 ? '#131f2e' : sunEl >= -18 ? '#0e1620' : '#0a0e13';

const CSS = `
.skw{position:fixed;z-index:26;left:262px;top:84px;width:580px;height:680px;min-width:340px;min-height:420px;display:flex;flex-direction:column;
  background:#171c22;border:1px solid #3a4654;border-radius:8px;box-shadow:0 10px 34px rgba(0,0,0,.7);resize:both;overflow:hidden;font:11px/1.4 ${MONO}}
.skw-title{height:28px;flex:none;display:flex;align-items:center;gap:8px;padding:0 4px 0 10px;background:linear-gradient(#232b35,#1b2129);
  border-bottom:1px solid #2a323c;cursor:grab;user-select:none;touch-action:none;font:600 12px ${MONO};color:#e8eaed}
.skw-title .sub{color:#9aa4ae;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.skw .skw-close{margin-left:auto;width:24px;height:22px;border:0;border-radius:4px;background:none;color:#9aa4ae;padding:0;font-size:13px;line-height:1}
.skw .skw-close:hover{background:#ff5252;color:#fff}
.skw-body{position:relative;flex:1;min-height:0}
.skw canvas{position:absolute;left:0;top:0;display:block}
.skc-top{position:absolute;top:6px;left:6px;right:6px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;pointer-events:none;z-index:5}
.skc-toolbar{display:flex;flex-wrap:wrap;gap:3px;pointer-events:auto;opacity:.9}.skc-toolbar:hover{opacity:1}
.skw .skc-tbtn{min-width:26px;padding:2px 6px;font:11px ${MONO};background:#1e242c;border:1px solid #2a323c;border-radius:4px;color:#e8eaed;line-height:1.4}
.skw .skc-tbtn:hover{border-color:#2a7ea8}.skw .skc-tbtn.skc-on{outline:1px solid #4fc3f7;color:#4fc3f7}
.skc-hud{font:11px ${MONO};font-variant-numeric:tabular-nums;color:#e8eaed;background:rgba(10,14,18,.66);padding:2px 7px;border-radius:3px;line-height:1.5;max-width:100%}
.skc-hud.skc-foot{color:#9aa4ae}
.skc-loc{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid #2a323c;background:#12171c;color:#9aa4ae}
.skw .skc-loc select,.skw .skc-loc input{font:11px ${MONO};font-variant-numeric:tabular-nums;color:#e8eaed;background:#0c1014;border:1px solid #2a323c;border-radius:4px;padding:2px 5px}
.skw .skc-loc select{max-width:170px}.skw .skc-loc input{width:92px}
.skc-err{color:#ff7a7a}
.skc-passes{flex:none;display:flex;flex-wrap:wrap;gap:4px;padding:6px;border-top:1px solid #2a323c;background:#12171c;max-height:76px;overflow:auto}
.skw .skc-chip{font:11px ${MONO};font-variant-numeric:tabular-nums;background:#1e242c;border:1px solid #2a323c;border-radius:10px;color:#cfd6dd;padding:2px 8px;white-space:nowrap;line-height:1.4}
.skw .skc-chip:hover{border-color:#2a7ea8;color:#fff}.skw .skc-chip.on{color:#4fc3f7;border-color:#2a7ea8;background:rgba(79,195,247,.10)}
.skc-chip .dark{color:#ffd54f}.skc-none{color:#9aa4ae;padding:2px 4px}
@media (max-width:860px){.skw{left:max(16px,env(safe-area-inset-left,0px))!important;right:max(16px,env(safe-area-inset-right,0px));width:auto!important;
  top:calc(104px + env(safe-area-inset-top,0px))!important;height:min(76dvh,640px)!important;min-height:0;resize:none}.skw .skc-loc input{width:78px}.skw .skc-loc select{max-width:120px}}
`;

export function createSkyChart({ data, catalog, getTime, onJump = () => {}, onSite = () => {} }) {
  const startMs = Date.parse(data.meta.start_utc), elapsed = data.elapsed_s, duration = data.meta.duration_s;
  const utcMs = t => startMs + t * 1000, hhmm = t => { const d = new Date(utcMs(t)); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const stars = catalog.stars.map(([ra, dec, v]) => ({ u: O.radecVector(ra, dec), ...starAppearance(v) }));
  const names = catalog.names.map(([ra, dec, name]) => [O.radecVector(ra, dec), name]);
  const cons = catalog.cons.map(([ra, dec, name]) => [O.radecVector(ra, dec), name.toUpperCase()]);
  const lines = catalog.lines.map(line => line.map(([ra, dec]) => O.radecVector(ra, dec)));
  const cfg = { mode: 'field', fov: 20, follow: false, zenithUp: false, eastLeft: true, grid: true, stars: true, starNames: true, constLines: true, constNames: true, sunMoon: true };
  let win, canvas, ctx, body, top, hud, sub, foot, title, chips, selectEl, buttons = {};
  let cssW = 0, cssH = 0, dpr = 1, site = null, frame = null, track = null, passes = [], selected = 'auto', chipKey = '', queued = false, lastView = null, boxes = [];

  // ------------------------------------------------------------ window
  function build() {
    if (!document.getElementById('skw-style')) { const st = document.createElement('style'); st.id = 'skw-style'; st.textContent = CSS; document.head.appendChild(st); }
    win = document.createElement('div'); win.className = 'skw'; win.hidden = true;
    win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', 'Ground sky chart');
    const groups = [...new Set(PLACES.map(p => p.region))].map(region => `<optgroup label="${region}">${PLACES.filter(p => p.region === region).map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</optgroup>`).join('');
    win.innerHTML = `<div class="skw-title"><span>Sky Chart</span><span class="sub"></span><button class="skw-close" aria-label="Close sky chart" title="Close (Esc)">✕</button></div>
      <div class="skc-loc"><label>Site <select class="skc-site"><option value="custom">Custom coordinates</option>${groups}</select></label>
        <label>Lat <input class="skc-lat" type="number" step="0.0001" min="-90" max="90" title="Decimal degrees, north positive"></label>
        <label>Lon <input class="skc-lon" type="number" step="0.0001" min="-180" max="180" title="Decimal degrees, east positive"></label>
        <button class="skc-tbtn skc-go" title="Show the sky from these coordinates (Enter)">Show</button><span class="skc-err" aria-live="polite"></span></div>
      <div class="skw-body"><canvas role="img"></canvas><div class="skc-top"><div class="skc-toolbar"></div><div class="skc-hud skc-main"></div><div class="skc-hud skc-sub"></div><div class="skc-hud skc-foot"></div></div></div>
      <div class="skc-passes" aria-label="Passes above the horizon"></div>`;
    document.body.appendChild(win);
    body = win.querySelector('.skw-body'); canvas = win.querySelector('canvas'); ctx = canvas.getContext('2d');
    top = win.querySelector('.skc-top'); hud = win.querySelector('.skc-main'); sub = win.querySelector('.skc-sub'); foot = win.querySelector('.skc-foot');
    title = win.querySelector('.skw-title .sub'); chips = win.querySelector('.skc-passes'); selectEl = win.querySelector('.skc-site');
    win.querySelector('.skw-close').addEventListener('click', close);
    const lat = win.querySelector('.skc-lat'), lon = win.querySelector('.skc-lon'), err = win.querySelector('.skc-err');
    const apply = () => {
      let a = parseFloat(lat.value), b = parseFloat(lon.value);
      if (b > 180 && b <= 360) b -= 360;
      if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) { err.textContent = 'lat −90…90, lon −180…180'; return; }
      setSite({ lat: +a.toFixed(4), lon: +b.toFixed(4), custom: true });
    };
    win.querySelector('.skc-go').addEventListener('click', apply);
    for (const el of [lat, lon]) el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') apply(); });
    selectEl.addEventListener('change', () => { const place = PLACES.find(p => p.id === selectEl.value); if (place) setSite(place); });
    const bar = win.querySelector('.skc-toolbar');
    const mk = (key, label, tip, fn) => { const b = document.createElement('button'); b.className = 'skc-tbtn'; b.textContent = label; b.title = tip; b.setAttribute('aria-label', tip); b.addEventListener('click', () => { fn(); refresh(); request(); }); bar.appendChild(b); buttons[key] = b; };
    const toggle = key => () => { cfg[key] = !cfg[key]; };
    mk('field', 'Field', 'Partial-sky field: gnomonic RA/Dec chart framed on MMX, with the local horizon', () => { cfg.mode = 'field'; });
    mk('allsky', 'All-sky', 'All-sky alt-az locator: zenith at the centre, horizon at the rim', () => { cfg.mode = 'allsky'; });
    mk('fov', '20°', 'Field of view: 5°–80°, or Auto to fit the selected pass', () => { cfg.fov = FOVS[(FOVS.indexOf(cfg.fov) + 1) % FOVS.length]; });
    mk('follow', '⊙', 'Centre the field on MMX at the selected time', toggle('follow'));
    mk('zenithUp', 'N↑', 'Orientation: celestial north up, or the observer’s zenith up', toggle('zenithUp'));
    mk('grid', '#', 'RA/Dec grid', toggle('grid'));
    mk('sunMoon', '☉', 'Sun and Moon (Moon shows phase, true size when resolved)', toggle('sunMoon'));
    mk('stars', '✶', 'Hipparcos stars to V 6.6', toggle('stars'));
    mk('starNames', 'SN', 'Bright-star names', toggle('starNames'));
    mk('constLines', 'CL', 'Constellation lines', toggle('constLines'));
    mk('constNames', 'CN', 'Constellation names', toggle('constNames'));
    mk('eastLeft', 'E⇄', 'Flip east/west: sky view (east left) or map view', toggle('eastLeft'));
    refresh();
    const bar0 = win.querySelector('.skw-title');
    bar0.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      bar0.setPointerCapture(e.pointerId); bar0.style.cursor = 'grabbing';
      const move = ev => { win.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px'; win.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; };
      const up = () => { bar0.removeEventListener('pointermove', move); bar0.removeEventListener('pointerup', up); bar0.style.cursor = ''; };
      bar0.addEventListener('pointermove', move); bar0.addEventListener('pointerup', up);
    });
    canvas.addEventListener('wheel', e => {
      if (cfg.mode !== 'field') return;
      e.preventDefault();
      const fixed = FOVS.filter(Number.isFinite), now = cfg.fov === 'auto' ? (lastView?.fov ?? 20) : cfg.fov;
      cfg.fov = e.deltaY > 0 ? (fixed.find(v => v > now + .5) ?? 80) : ([...fixed].reverse().find(v => v < now - .5) ?? 5);
      refresh(); request();
    }, { passive: false });
    chips.addEventListener('click', e => {
      const chip = e.target.closest('.skc-chip'); if (!chip) return;
      chipKey = '';
      if (chip.dataset.i === 'auto') { selected = 'auto'; request(); return; }
      selected = Number(chip.dataset.i);
      const pass = passes[selected]; onJump(pass.best ?? pass.tMax);
    });
    new ResizeObserver(resize).observe(body);
    addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen() && !document.querySelector('dialog[open]')) close(); });
  }
  function refresh() {
    const field = cfg.mode === 'field';
    buttons.field.classList.toggle('skc-on', field); buttons.allsky.classList.toggle('skc-on', !field);
    buttons.fov.textContent = cfg.fov === 'auto' ? 'Auto' : `${cfg.fov}°`;
    buttons.zenithUp.textContent = cfg.zenithUp ? 'Z↑' : 'N↑';
    for (const key of ['fov', 'follow', 'zenithUp', 'grid']) buttons[key].hidden = !field;
    for (const key of ['follow', 'grid', 'sunMoon', 'stars', 'starNames', 'constLines', 'constNames']) buttons[key].classList.toggle('skc-on', cfg[key]);
    for (const key of ['field', 'allsky', 'follow', 'grid', 'sunMoon', 'stars', 'starNames', 'constLines', 'constNames']) buttons[key].setAttribute('aria-pressed', String(buttons[key].classList.contains('skc-on')));
  }
  function resize() {
    const r = body.getBoundingClientRect(), w = Math.max(1, Math.floor(r.width)), h = Math.max(1, Math.floor(r.height)), d = devicePixelRatio || 1;
    if (w === cssW && h === cssH && d === dpr) return;
    cssW = w; cssH = h; dpr = d; canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; request();
  }
  function setSite(place) {
    site = place.custom ? { id: null, name: 'Custom site', lat: place.lat, lon: place.lon, heightKm: 0, tz: null, custom: true }
      : { id: place.id, name: place.name, lat: place.lat, lon: place.lon, heightKm: place.heightKm || 0, tz: place.tz, note: place.note, custom: false };
    frame = O.siteFrame(site.lat, site.lon, site.heightKm);
    track = O.siteTrack(data, frame); passes = O.findPasses(elapsed, track);
    for (const pass of passes) {
      const dirs = [];
      for (let i = pass.first; i <= pass.last; i++) dirs.push([track.direction[3 * i], track.direction[3 * i + 1], track.direction[3 * i + 2]]);
      pass.cap = O.enclosingCap(dirs);
    }
    selected = 'auto'; chipKey = '';
    selectEl.value = site.custom ? 'custom' : site.id;
    title.textContent = `— MMX from ${site.custom ? fmtLL(site.lat, site.lon) : site.name}`;
    win.querySelector('.skc-lat').value = site.lat.toFixed(4); win.querySelector('.skc-lon').value = site.lon.toFixed(4);
    win.querySelector('.skc-err').textContent = '';
    onSite({ ...site });
    request();
  }
  function open(place, focus = false) {
    if (!win) build();
    win.hidden = false; resize(); setSite(place);
    if (focus) win.querySelector('.skw-close').focus();
  }
  function close() { if (!win || win.hidden) return; win.hidden = true; onSite(null); document.getElementById('open-sky')?.focus(); }
  const isOpen = () => !!win && !win.hidden;
  function request() {
    if (queued || !isOpen()) return;
    queued = true; requestAnimationFrame(() => { queued = false; render(); });
  }

  // ------------------------------------------------------------ geometry at the selected time
  function lookAt(t) {
    const s = sample(data, t), now = O.orientSite(frame, O.quaternionAt(data, s.i, s.u));
    return { s, now, mmx: O.topocentric(now, s.mmx), sun: O.topocentric(now, s.sun), moon: O.topocentric(now, s.moon) };
  }
  function currentPass(t) {
    if (!passes.length) return -1;
    if (selected !== 'auto') return selected;
    let i = passes.findIndex(p => t >= p.aos && t <= p.los);
    if (i < 0) i = passes.findIndex(p => p.aos > t);
    return i < 0 ? passes.length - 1 : i;
  }
  const trackDir = i => [track.direction[3 * i], track.direction[3 * i + 1], track.direction[3 * i + 2]];
  // Interpolated rise/set point on the horizon, between samples k − 1 and k.
  function edgeDir(k) { const a = trackDir(k - 1), b = trackDir(k), f = track.el[k - 1] / (track.el[k - 1] - track.el[k]); return normalize(a.map((v, j) => v + f * (b[j] - v))); }

  // ------------------------------------------------------------ text helpers
  function haloText(text, x, y, fill, align = 'left') {
    if (align === 'left' && x + ctx.measureText(text).width > cssW - 3) { align = 'right'; x -= 10; }
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.strokeStyle = C.halo; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  // Per-render label registry: a label is drawn only where it overlaps no earlier one.
  function claim(x, y, w, h) {
    if (boxes.some(b => x < b[0] + b[2] && b[0] < x + w && y < b[1] + b[3] && b[1] < y + h)) return false;
    boxes.push([x, y, w, h]); return true;
  }
  function label(text, x, y, fill, align = 'left') {
    const w = ctx.measureText(text).width;
    if (align === 'left' && x + w > cssW - 3) { align = 'right'; x -= 10; }
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    if (!claim(left - 1, y - 7, w + 2, 14)) return false;
    haloText(text, x, y, fill, align); return true;
  }
  function timeBox(text, x, y) {
    const w = ctx.measureText(text).width + 6, h = 12;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y - h + 2, w, h, 3) : ctx.rect(x, y - h + 2, w, h);
    ctx.fillStyle = 'rgba(10,14,18,0.74)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, x + 3, y);
  }
  // Roman-chart sizes. The partial field raises the floor so V ≈ 6 stars stay visible; the all-sky locator keeps them faint.
  function starDot(x, y, star, scale = 1, minRadius = 1, minOpacity = .7) {
    const r = Math.max(minRadius, star.diameter * scale / 2);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fillStyle = `rgba(236,240,248,${Math.max(minOpacity, star.opacity)})`; ctx.fill();
    if (star.ringDiameter) { ctx.beginPath(); ctx.arc(x, y, star.ringDiameter * scale / 2, 0, 2 * Math.PI); ctx.strokeStyle = 'rgba(207,216,232,0.7)'; ctx.lineWidth = .8; ctx.stroke(); }
  }
  // Moon phase: sun-side semicircle closed by the terminator ellipse; cosPsi is the cosine of the Sun–Moon elongation.
  function moonDisc(x, y, radius, towardSun, cosPsi) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(towardSun);
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, 2 * Math.PI); ctx.fillStyle = '#3c4148'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2, false);
    ctx.ellipse(0, 0, radius * Math.abs(cosPsi), radius, 0, Math.PI / 2, -Math.PI / 2, cosPsi > 0); ctx.fillStyle = '#e6e2d6'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, 2 * Math.PI); ctx.strokeStyle = 'rgba(8,10,14,0.7)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }
  function sunDisc(x, y, radius) {
    ctx.strokeStyle = C.sun; ctx.lineWidth = 1.5;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (radius + 2), y + Math.sin(a) * (radius + 2)); ctx.lineTo(x + Math.cos(a) * (radius + 6), y + Math.sin(a) * (radius + 6)); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fillStyle = C.sun; ctx.fill();
  }
  function mmxMarker(x, y, up, label) {
    ctx.save(); ctx.globalAlpha = up ? 1 : .55; ctx.translate(x, y); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = C.pass; ctx.strokeStyle = 'rgba(8,10,14,0.9)'; ctx.lineWidth = 1; ctx.fillRect(-3.5, -3.5, 7, 7); ctx.strokeRect(-3.5, -3.5, 7, 7); ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, 7.5, 0, 2 * Math.PI); ctx.strokeStyle = up ? '#ffffff' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.font = '11px ' + MONO; haloText(label, x + 11, y, '#ffffff');
  }
  function tickStep(seconds, limit) { return TICKS.find(step => seconds / step <= limit) ?? TICKS.at(-1); }

  // ------------------------------------------------------------ field: partial-sky gnomonic RA/Dec chart
  function fieldView(g, area, pi) {
    const pass = pi >= 0 ? passes[pi] : null;
    const center = cfg.follow || !pass?.cap ? g.mmx.direction : pass.cap.center;
    const autoFov = pass?.cap ? Math.min(80, Math.max(20, Math.ceil(pass.cap.radius * 2.5))) : 20;
    const fov = cfg.fov === 'auto' ? (cfg.follow ? Math.min(autoFov, 20) : autoFov) : cfg.fov;
    const tf = O.tangentFrame(center), f = Math.min(area.w, area.h) / 2 / Math.tan(fov / 2 * D2R);
    let theta = 0;
    if (cfg.zenithUp) { const zx = dot(g.now.up, tf.east), zy = dot(g.now.up, tf.north); if (Math.hypot(zx, zy) > 1e-6) theta = Math.atan2(zx, zy); }
    const cos = Math.cos(theta), sin = Math.sin(theta), sx = cfg.eastLeft ? -1 : 1, cx = area.x + area.w / 2, cy = area.y + area.h / 2;
    const corner = Math.atan(Math.hypot(area.w, area.h) / 2 / f) * R2D;
    const kTight = Math.cos(Math.min(88, corner + 2) * D2R), kLoose = Math.cos(Math.min(80, corner + 25) * D2R);
    const screen = (xi, eta) => ({ x: cx + sx * f * (xi * cos - eta * sin), y: cy - f * (xi * sin + eta * cos) });
    const plane = (X, Y) => { const a = sx * (X - cx) / f, b = (cy - Y) / f; return [a * cos + b * sin, -a * sin + b * cos]; };
    const project = (u, loose = false) => {
      const k = dot(u, tf.center); if (k < (loose ? kLoose : kTight)) return null;
      return screen(dot(u, tf.east) / k, dot(u, tf.north) / k);
    };
    return { center, fov, f, tf, theta, area, cx, cy, screen, plane, project, inside: p => p && p.x >= area.x && p.x <= area.x + area.w && p.y >= area.y && p.y <= area.y + area.h };
  }

  function drawField(g, area, pi) {
    const v = lastView = fieldView(g, area, pi), pass = pi >= 0 ? passes[pi] : null;
    const ax = area.x + area.w - 34, ay = area.y + area.h - 34;
    claim(ax - 34, ay - 34, 68, 68);
    const now = v.project(g.mmx.direction, true);
    if (v.inside(now)) { ctx.font = '11px ' + MONO; claim(now.x - 9, now.y - 9, ctx.measureText('MMX · below horizon').width + 24, 18); }
    ctx.save(); ctx.beginPath(); ctx.rect(area.x, area.y, area.w, area.h); ctx.clip();
    ctx.fillStyle = skyBg(g.sun.el); ctx.fillRect(area.x, area.y, area.w, area.h);
    if (cfg.grid) drawRaDecGrid(v);
    if (cfg.constLines) {
      ctx.strokeStyle = C.lines; ctx.lineWidth = 1; ctx.beginPath();
      for (const line of lines) for (let i = 1; i < line.length; i++) {
        const a = v.project(line[i - 1], true), b = v.project(line[i], true);
        if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      }
      ctx.stroke();
    }
    const scale = Math.max(.75, Math.min(1.25, 20 / v.fov));
    if (cfg.stars) for (const star of stars) { const p = v.project(star.u); if (v.inside(p)) starDot(p.x, p.y, star, scale); }
    ctx.font = '9px ' + MONO;
    if (cfg.starNames) for (const [u, name] of names) { const p = v.project(u); if (v.inside(p)) label(name, p.x + 6, p.y - 5, 'rgba(185,205,240,0.9)'); }
    if (cfg.constNames) { ctx.font = '10px ' + MONO; for (const [u, name] of cons) { const p = v.project(u); if (v.inside(p)) label(name, p.x, p.y, 'rgba(140,165,215,0.75)', 'center'); } }
    if (cfg.sunMoon) drawBodiesField(g, v);
    drawGround(g, v);
    drawTrackField(g, v, pass);
    ctx.restore();
    // Orientation arrows, outside the clip so they stay legible.
    const o = v.screen(0, 0), n = v.screen(0, .02), e = v.screen(.02, 0);
    ctx.font = '10px ' + MONO;
    for (const [p, label] of [[n, 'N'], [e, 'E']]) {
      const dx = p.x - o.x, dy = p.y - o.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + ux * 20, ay + uy * 20); ctx.strokeStyle = C.dim; ctx.lineWidth = 1.2; ctx.stroke();
      haloText(label, ax + ux * 27, ay + uy * 27, label === 'N' ? C.ink : C.dim, 'center');
    }
  }

  function drawRaDecGrid(v) {
    const [ra0, dec0] = [(Math.atan2(v.center[1], v.center[0]) * R2D + 360) % 360, Math.asin(v.center[2]) * R2D];
    const decStep = [.5, 1, 2, 5, 10, 15, 30].find(step => v.fov / step <= 7) ?? 30;
    const raStep = [.5, 1, 2.5, 5, 7.5, 15, 30].find(step => v.fov / (step * Math.max(.2, Math.cos(dec0 * D2R))) <= 7) ?? 30;
    const reach = Math.min(89, Math.atan(Math.hypot(v.area.w, v.area.h) / 2 / v.f) * R2D + 2);
    const raHalf = Math.abs(dec0) + reach >= 89 ? 180 : Math.asin(Math.min(1, Math.sin(reach * D2R) / Math.cos(dec0 * D2R))) * R2D + raStep;
    const sampleStep = Math.max(.05, v.fov / 120), labels = [];
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    const polyline = (points, label, prefer) => {
      ctx.beginPath(); let prev = null, best = null;
      for (const u of points) {
        const p = v.project(u, true);
        if (!p) { prev = null; continue; }
        if (prev) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        prev = p;
        if (v.inside(p) && (!best || prefer(p, best))) best = p;
      }
      ctx.stroke(); if (best) labels.push([label, best]);
    };
    for (let ra = Math.ceil((ra0 - raHalf) / raStep) * raStep; ra <= ra0 + raHalf + 1e-9; ra += raStep) {
      const points = [], wrapped = (ra % 360 + 360) % 360;
      for (let dec = Math.max(-90, dec0 - reach); dec <= Math.min(90, dec0 + reach); dec += sampleStep) points.push(O.radecVector(wrapped, dec));
      const m = Math.round(wrapped / 15 * 60) % 1440;
      polyline(points, raStep < 15 ? `${Math.floor(m / 60)}h${pad(m % 60)}m` : `${Math.floor(m / 60)}h`, (p, q) => p.y < q.y);
    }
    for (let dec = Math.ceil((dec0 - reach) / decStep) * decStep; dec <= dec0 + reach; dec += decStep) {
      if (Math.abs(dec) >= 90) continue;
      const points = [];
      for (let d = -raHalf; d <= raHalf; d += sampleStep / Math.max(.05, Math.cos(dec * D2R))) points.push(O.radecVector(ra0 + d, dec));
      polyline(points, `${dec < 0 ? '−' : '+'}${Math.abs(dec)}°`, (p, q) => p.x < q.x);
    }
    ctx.font = '9px ' + MONO;
    for (const [text, p] of labels) label(text, Math.max(v.area.x + 3, p.x + 3), Math.max(v.area.y + 8, Math.min(v.area.y + v.area.h - 8, p.y + 8)), C.gridInk);
  }

  function drawBodiesField(g, v) {
    const sunP = v.project(g.sun.direction, true), moonP = v.project(g.moon.direction, true);
    if (v.inside(sunP)) sunDisc(sunP.x, sunP.y, Math.max(5, v.f * Math.tan(Math.asin(695700 / g.sun.range))));
    if (v.inside(moonP)) {
      const step = normalize(g.moon.direction.map((m, k) => m + .01 * (g.sun.direction[k] - m))), q = v.project(step, true);
      const toward = q ? Math.atan2(q.y - moonP.y, q.x - moonP.x) : 0;
      moonDisc(moonP.x, moonP.y, Math.max(5.5, v.f * Math.tan(Math.asin(1737.4 / g.moon.range))), toward, dot(g.moon.direction, g.sun.direction));
      ctx.font = '10px ' + MONO; label('Moon', moonP.x + 9, moonP.y + 10, C.dim);
    }
  }

  // Ground below the geometric horizon: the horizon is a great circle, hence a straight line in the gnomonic plane.
  function drawGround(g, v) {
    const z = g.now.up, zc = dot(z, v.tf.center), ze = dot(z, v.tf.east), zn = dot(z, v.tf.north);
    const height = (X, Y) => { const [xi, eta] = v.plane(X, Y); return zc + xi * ze + eta * zn; };
    const { x, y, w, h } = v.area, corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], polygon = [], edge = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4], ha = height(...a), hb = height(...b);
      if (ha < 0) polygon.push(a);
      if ((ha < 0) !== (hb < 0)) { const f = ha / (ha - hb), p = [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]; polygon.push(p); edge.push(p); }
    }
    if (polygon.length > 2) { ctx.beginPath(); polygon.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = C.ground; ctx.fill(); }
    if (edge.length === 2) { ctx.beginPath(); ctx.moveTo(...edge[0]); ctx.lineTo(...edge[1]); ctx.strokeStyle = 'rgba(232,234,237,0.55)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.font = '10px ' + MONO;
    for (let az = 0; az < 360; az += 45) {
      const p = v.project(O.fromHorizontal(g.now, az, 0));
      if (!v.inside(p)) continue;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI); ctx.fillStyle = C.ink; ctx.fill();
      label(COMPASS[az / 22.5], p.x, p.y + 12, az ? C.dim : C.ink, 'center');
    }
  }

  function drawTrackField(g, v, pass) {
    const t = getTime(), n = elapsed.length;
    // Whole six-day topocentric path: thin, dashed below the horizon.
    ctx.lineWidth = 1; let style = null, prev = null;
    const stroke = () => { if (style !== null) { ctx.setLineDash(style ? [] : [3, 4]); ctx.strokeStyle = hexA(C.track, style ? .7 : .45); ctx.stroke(); } style = null; };
    for (let i = 0; i < n; i++) {
      const p = v.project(trackDir(i), true), up = track.el[i] > 0;
      if (!p) { stroke(); prev = null; continue; }
      if (prev) {
        if (style !== up) { stroke(); ctx.beginPath(); ctx.moveTo(prev.x, prev.y); style = up; }
        ctx.lineTo(p.x, p.y);
      }
      prev = p;
    }
    stroke(); ctx.setLineDash([]);
    if (!pass) return;
    // Selected pass: solid in sunlight, dashed in Earth's shadow, dimmer once flown past the selected time.
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (let i = Math.max(1, pass.first); i <= pass.last; i++) {
      const a = v.project(trackDir(i - 1), true), b = v.project(trackDir(i), true);
      if (!a || !b) continue;
      ctx.setLineDash(track.lit[i] ? [] : [3, 3]); ctx.strokeStyle = hexA(C.pass, elapsed[i] <= t ? .45 : .95);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Late passes are tiny loops in a star-fixed field; time ticks only help when the pass spans a readable length.
    const span = [pass.first, Math.round((pass.first + pass.last) / 2), pass.last].map(i => v.project(trackDir(i), true)).filter(Boolean);
    const extent = span.length > 1 ? Math.max(...span.map(a => Math.max(...span.map(b => Math.hypot(a.x - b.x, a.y - b.y))))) : 0;
    if (extent > 60) {
      drawTicks(pass, (az, el, u) => v.project(u), v.inside, 14);
      ctx.font = '10px ' + MONO;
      if (!pass.startsBefore) { const p = v.project(edgeDir(pass.first)); if (v.inside(p)) label('↑' + hhmm(pass.aos), p.x + 5, p.y - 9, C.pass); }
      if (!pass.endsAfter) { const p = v.project(edgeDir(pass.last + 1)); if (v.inside(p)) label('↓' + hhmm(pass.los), p.x + 5, p.y + 9, C.pass); }
    }
    const p = v.project(g.mmx.direction, true);
    if (v.inside(p)) mmxMarker(p.x, p.y, g.mmx.el > 0, g.mmx.el > 0 ? 'MMX' : 'MMX · below horizon');
    else offChart(v, g.mmx.direction);
  }
  // Edge pointer toward MMX when it lies outside the field.
  function offChart(v, u) {
    // The great-circle bearing from the field centre is (u·east, u·north), whether or not u lies in front of the plane.
    const q = v.screen(dot(u, v.tf.east), dot(u, v.tf.north));
    const dx = q.x - v.cx, dy = q.y - v.cy, s = Math.min((v.area.w / 2 - 22) / Math.abs(dx || 1e-9), (v.area.h / 2 - 22) / Math.abs(dy || 1e-9));
    const x = v.cx + dx * s, y = v.cy + dy * s, a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fillStyle = C.pass; ctx.fill(); ctx.restore();
    ctx.font = '10px ' + MONO; haloText('MMX', x - Math.cos(a) * 18, y - Math.sin(a) * 18, C.pass, 'center');
  }

  // Time ticks along a pass: round UTC epochs, with marker and label collision checks. With reserve set, only the
  // label boxes are claimed, so names drawn afterwards avoid them.
  const reserved = new Map();
  function drawTicks(pass, projector, inside, limit, reserve = false) {
    const step = tickStep(pass.los - pass.aos, limit), dots = [];
    ctx.font = '9px ' + MONO;
    for (let tt = Math.ceil(utcMs(pass.aos) / 1000 / step) * step - startMs / 1000; tt < pass.los; tt += step) {
      if (tt <= pass.aos) continue;
      const g = lookAt(tt), p = projector(g.mmx.az, g.mmx.el, g.mmx.direction);
      if (!inside(p) || g.mmx.el < 0 || dots.some(d => Math.hypot(d.x - p.x, d.y - p.y) < 7)) continue;
      dots.push(p);
      const text = hhmm(tt), w = ctx.measureText(text).width + 6, lx = p.x + 5 + w > cssW - 3 ? p.x - 5 - w : p.x + 5;
      if (reserve) { if (claim(lx, p.y - 15, w, 12)) reserved.set(tt, lx); continue; }
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 2 * Math.PI); ctx.fillStyle = C.pass; ctx.fill(); ctx.strokeStyle = 'rgba(8,10,14,0.9)'; ctx.lineWidth = 1; ctx.stroke();
      if (reserved.has(tt)) timeBox(text, reserved.get(tt), p.y - 5);
      else if (claim(lx, p.y - 15, w, 12)) timeBox(text, lx, p.y - 5);
    }
  }

  // ------------------------------------------------------------ all-sky alt-az locator (SatObserver-MX layout)
  function drawAllSky(g, area, pi) {
    const m = { cx: area.x + area.w / 2, cy: area.y + area.h / 2, R: Math.max(30, Math.min(area.w, area.h) / 2 - 26) }, sx = cfg.eastLeft ? -1 : 1;
    const project = (az, el) => { const r = (90 - Math.max(el, -5)) / 90 * m.R, a = az * D2R; return { x: m.cx + sx * r * Math.sin(a), y: m.cy - r * Math.cos(a) }; };
    const projectU = u => { const h = O.horizontal(g.now, u); return h.el > 0 ? project(h.az, h.el) : null; };
    ctx.beginPath(); ctx.arc(m.cx, m.cy, m.R, 0, 2 * Math.PI); ctx.fillStyle = skyBg(g.sun.el); ctx.fill();
    ctx.lineWidth = 1;
    for (let el = 0; el < 90; el += 30) { ctx.beginPath(); ctx.arc(m.cx, m.cy, (90 - el) / 90 * m.R, 0, 2 * Math.PI); ctx.strokeStyle = el ? 'rgba(232,234,237,0.16)' : 'rgba(232,234,237,0.5)'; ctx.stroke(); }
    ctx.font = '11px ' + MONO;
    for (let i = 0; i < 8; i++) {
      const pe = project(i * 45, 0), pl = project(i * 45, -14);
      ctx.beginPath(); ctx.moveTo(m.cx, m.cy); ctx.lineTo(pe.x, pe.y); ctx.strokeStyle = 'rgba(232,234,237,0.10)'; ctx.stroke();
      ctx.fillStyle = i ? C.dim : C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(COMPASS[i * 2], pl.x, pl.y);
    }
    ctx.font = '10px ' + MONO; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(154,164,174,0.75)';
    for (const el of [0, 30, 60]) { const p = project(22.5, el); ctx.fillText(el + '°', p.x + 2, p.y); }
    if (cfg.constLines) {
      ctx.strokeStyle = C.lines; ctx.beginPath();
      for (const line of lines) for (let i = 1; i < line.length; i++) { const a = projectU(line[i - 1]), b = projectU(line[i]); if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } }
      ctx.stroke();
    }
    if (cfg.stars) for (const star of stars) { const p = projectU(star.u); if (p) starDot(p.x, p.y, star, .8, .4, 0); }
    ctx.font = '9px ' + MONO;
    // Track labels outrank star names in the crowded all-sky view.
    const pass = pi >= 0 ? passes[pi] : null, t = getTime();
    if (g.mmx.el > 0) { const p = project(g.mmx.az, g.mmx.el); ctx.font = '11px ' + MONO; claim(p.x - 9, p.y - 9, ctx.measureText('MMX').width + 24, 18); }
    if (pass) {
      ctx.font = '10px ' + MONO;
      if (!pass.startsBefore) { const p = project(pass.azRise, 0); label('↑' + hhmm(pass.aos), p.x + 4, p.y - 8, C.pass); }
      if (!pass.endsAfter) { const p = project(pass.azSet, 0); label('↓' + hhmm(pass.los), p.x + 4, p.y + 8, C.pass); }
      drawTicks(pass, (az, el) => project(az, el), p => !!p, 16, true);
    }
    ctx.font = '9px ' + MONO;
    if (cfg.starNames) for (const [u, name] of names) { const p = projectU(u); if (p) label(name, p.x + 5, p.y - 4, 'rgba(185,205,240,0.9)'); }
    if (cfg.constNames) { ctx.font = '10px ' + MONO; for (const [u, name] of cons) { const p = projectU(u); if (p) label(name, p.x, p.y, 'rgba(140,165,215,0.5)', 'center'); } }
    if (cfg.sunMoon) {
      if (g.sun.el > 0) { const p = project(g.sun.az, g.sun.el); sunDisc(p.x, p.y, 5); }
      if (g.moon.el > 0) {
        const p = project(g.moon.az, g.moon.el), ps = project(g.sun.az, g.sun.el);
        moonDisc(p.x, p.y, 5.5, Math.atan2(ps.y - p.y, ps.x - p.x), dot(g.moon.direction, g.sun.direction));
      }
    }
    if (pass) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 1.8;
      for (let i = pass.first + 1; i <= pass.last; i++) {
        const a = project(track.az[i - 1], track.el[i - 1]), b = project(track.az[i], track.el[i]);
        ctx.setLineDash(track.lit[i] ? [] : [3, 3]); ctx.strokeStyle = hexA(C.pass, elapsed[i] <= t ? .4 : .9);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.setLineDash([]);
      drawTicks(pass, (az, el) => project(az, el), p => !!p, 16);
    }
    if (g.mmx.el > 0) { const p = project(g.mmx.az, g.mmx.el); mmxMarker(p.x, p.y, true, 'MMX'); }
  }

  // ------------------------------------------------------------ chips, HUD and frame
  function updateChips(pi) {
    const key = `${site.lat},${site.lon}|${selected}|${pi}`;
    if (key === chipKey) return;
    chipKey = key;
    if (!passes.length) { chips.innerHTML = '<span class="skc-none">MMX stays below this horizon throughout the window.</span>'; return; }
    const day = t => new Date(utcMs(t)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    chips.innerHTML = `<button class="skc-chip${selected === 'auto' ? ' on' : ''}" data-i="auto" title="Follow the current or next pass">Auto</button>` + passes.map((p, i) => {
      const dark = p.darkSeconds >= 60 ? ` · <span class="dark">☾ ${Math.floor(p.darkSeconds / 3600)}h${pad(Math.round(p.darkSeconds % 3600 / 60))}m</span>` : '';
      const rise = p.startsBefore ? '↑start' : `↑${hhmm(p.aos)}`, set = p.endsAfter ? '↓end' : `↓${hhmm(p.los)}`;
      const tip = `${dir16(p.azRise)} → ${dir16(p.azSet)}. Click to jump to ${p.best !== null ? 'the highest dark-sky epoch' : 'culmination'}. Dark sky: MMX sunlit, ≥15° high, Sun ≤ −12°.`;
      return `<button class="skc-chip${selected === i ? ' on' : ''}${i === pi ? ' now' : ''}" data-i="${i}" title="${tip}">${day(p.aos)} ${rise} ${set} · max ${p.maxEl.toFixed(0)}°${dark}</button>`;
    }).join('');
  }

  function render() {
    if (!isOpen() || !site || cssW < 2) return;
    const t = getTime(), g = lookAt(t), pi = currentPass(t), lit = O.sunlitFraction(g.s.mmx, g.s.sun) >= .5;
    updateChips(pi);
    const pass = pi >= 0 ? passes[pi] : null;
    let when = '';
    if (g.mmx.el <= 0) {
      const next = passes.find(p => p.aos > t);
      when = next ? ` · rises ${hhmm(next.aos)} UTC ${dir16(next.azRise)}` : ' · no further rise in this window';
    } else if (pass && !pass.endsAfter) when = ` · sets ${hhmm(pass.los)} UTC ${dir16(pass.azSet)}`;
    hud.textContent = `MMX  AZ ${g.mmx.az.toFixed(1)}°  EL ${g.mmx.el.toFixed(1)}°  RNG ${Math.round(g.mmx.range).toLocaleString('en-US')} km  |  ${lit ? '● sunlit' : '✕ Earth shadow'}`;
    sub.textContent = `RA ${hms(g.mmx.ra_deg)}  Dec ${dms(g.mmx.dec_deg)} topocentric  |  site Sun ${g.sun.el.toFixed(1)}° ${O.twilight(g.sun.el)}${when}`;
    const utc = new Date(utcMs(t)), clock = `UTC ${utc.toISOString().slice(0, 19).replace('T', ' ')}`;
    const local = site.tz ? new Intl.DateTimeFormat('en-GB', { timeZone: site.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' }).format(utc) : '';
    foot.textContent = `${site.name}  ${fmtLL(site.lat, site.lon)}${site.heightKm ? `  ${Math.round(site.heightKm * 1000)} m` : ''}  ·  ${local ? local + '  ·  ' : ''}${clock}`;
    const band = top.offsetHeight + 10, area = { x: 0, y: band, w: cssW, h: Math.max(60, cssH - band) };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#0a0e13'; ctx.fillRect(0, 0, cssW, cssH); boxes = []; reserved.clear();
    if (cfg.mode === 'field') drawField(g, area, pi); else { lastView = null; drawAllSky(g, area, pi); }
    canvas.setAttribute('aria-label', `${cfg.mode === 'field' ? 'Partial-sky field' : 'All-sky'} chart from ${site.name}: MMX azimuth ${g.mmx.az.toFixed(0)} degrees, elevation ${g.mmx.el.toFixed(0)} degrees.`);
  }

  return { open, close, isOpen, render: request, site: () => (site ? { ...site } : null),
    state: () => ({ open: isOpen(), site: site && { ...site }, mode: cfg.mode, fov: lastView?.fov ?? null, follow: cfg.follow, passes: passes.map(p => ({ ...p, cap: undefined })),
      selected, center: lastView && { ra: (Math.atan2(lastView.center[1], lastView.center[0]) * R2D + 360) % 360, dec: Math.asin(lastView.center[2]) * R2D },
      look: site ? (({ az, el, range, ra_deg, dec_deg }) => ({ az, el, range, ra_deg, dec_deg }))(lookAt(getTime()).mmx) : null }),
    configure: options => { Object.assign(cfg, options); if (win) { refresh(); request(); } } };
}
