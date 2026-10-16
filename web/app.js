import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { sample, sceneVector, utcAt, csvText } from './states.js';

const $ = id => document.getElementById(id);
const D = JSON.parse($('ephemeris-data').textContent);
const M = D.meta;
const duration = M.duration_s;
const C = { blue: '#3987e5', pale: '#a1d4fc', moon: '#c1c7ce', orange: '#d95926', ink: '#e8eaed', grid: '#303b47', surface: '#05070a' };
const fmt = (x, digits = 0) => x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const vector = a => new THREE.Vector3(...sceneVector(a, M.earth_radius_km));
const query = new URLSearchParams(location.search);
const allowedViews = ['full', 'departure', 'xy', 'xz', 'yz'];
const initialTime = Number(query.get('t') || 0);
const state = { t: Number.isFinite(initialTime) ? Math.max(0, Math.min(duration, initialTime)) : 0,
  playing: false, speed: 3600, view: allowedViews.includes(query.get('view')) ? query.get('view') : 'full',
  moon: true, axes: true, labels: true };
let current = sample(D, state.t);
let renderer, scene, camera, controls, earth, moon, mmxMarker, moonMarker, earthMarker, sunLight;
let moonPath, axesGroup, dayGroup, departureGroup, labelLayer, resizeObserver;
let renderReady = false, lastTime = null, lastUI = 0, lastWidth = 0, lastHeight = 0;
const lineMaterials = [], labels = [];
const charts = [];

function setPlaying(on) {
  if (on && state.t >= duration) setTime(0);
  state.playing = on;
  $('play').textContent = on ? 'Ⅱ Pause' : '▶ Play';
  $('play').setAttribute('aria-label', on ? 'Pause trajectory' : 'Play trajectory');
}

function setTime(seconds, pause = false) {
  if (pause) setPlaying(false);
  current = sample(D, seconds);
  state.t = current.t;
  updateUI();
  if (renderReady) updateScene();
}

function updateUI() {
  const utc = utcAt(D, Math.floor(state.t));
  $('utc-clock').textContent = utc.replace('T', ' ').replace('Z', '');
  $('utc-clock').dateTime = utc;
  $('timeline').value = state.t;
  $('timeline').setAttribute('aria-valuetext', utc);
  if (document.activeElement !== $('utc-input')) $('utc-input').value = utc.slice(0, 19);
  const days = Math.floor(state.t / 86400);
  const seconds = Math.floor(state.t % 86400);
  $('elapsed').textContent = `Window +${days}d ${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('range-value').textContent = fmt(current.earthRange, current.earthRange < 100000 ? 3 : 0);
  $('speed-value').textContent = `${fmt(current.speed, 3)} km/s`;
  $('moon-value').textContent = `${fmt(current.moonDistance)} km`;
  for (const [k, id] of ['x-value', 'y-value', 'z-value'].entries()) $(id).textContent = `${fmt(current.mmx[k], 3)} km`;
  updateCursors(state.t);
}

function makeLine(points, color, { dashed = false, opacity = 1, width = 2 } = {}) {
  const geometry = new LineGeometry();
  geometry.setPositions(points.flatMap(p => p.toArray()));
  const material = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity,
    dashed, dashSize: 2.2, gapSize: 1.4, worldUnits: false });
  const line = new Line2(geometry, material);
  if (dashed) line.computeLineDistances();
  lineMaterials.push(material);
  return line;
}

function pointMarker(color, size, depthTest = true) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(32, 32, 23, 0, 2 * Math.PI); ctx.fill();
  ctx.strokeStyle = C.surface; ctx.lineWidth = 5; ctx.stroke();
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: false, map,
    transparent: true, depthTest, depthWrite: false, alphaTest: .1 });
  return new THREE.Points(geometry, material);
}

function addLabel(text, getPosition, kind = 'fixed', offset = [10, -12]) {
  const el = document.createElement('div'); el.className = 'body-label'; el.textContent = text;
  labelLayer.appendChild(el);
  labels.push({ el, getPosition, kind, offset });
}

function boundsForView(view) {
  const points = [new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)];
  const limit = view === 'departure' ? 181 : D.states.mmx.length;
  for (let i = 0; i < limit; i += Math.max(1, Math.floor(limit / 1000))) points.push(vector(D.states.mmx[i]));
  points.push(vector(D.states.mmx[limit - 1]));
  if (view !== 'departure' && state.moon) for (let i = 0; i < D.states.moon.length; i += 60) points.push(vector(D.states.moon[i]));
  return new THREE.Box3().setFromPoints(points);
}

function fitCamera(view, resetEpoch = false) {
  if (!renderReady) return;
  state.view = view;
  if (resetEpoch && view === 'departure' && state.t > 10800) setTime(0, true);
  const box = boundsForView(view), sphere = box.getBoundingSphere(new THREE.Sphere());
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const distance = sphere.radius / Math.sin(Math.min(vfov, hfov) / 2) * 1.20;
  let direction;
  if (view === 'xy') { direction = new THREE.Vector3(0, 1, 0); camera.up.set(0, 0, -1); }
  else if (view === 'xz') { direction = new THREE.Vector3(0, 0, 1); camera.up.set(0, 1, 0); }
  else if (view === 'yz') { direction = new THREE.Vector3(1, 0, 0); camera.up.set(0, 1, 0); }
  else { direction = new THREE.Vector3(.25, .85, 1.4).normalize(); camera.up.set(0, 1, 0); }
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(direction, distance);
  camera.near = view === 'departure' ? .002 : .02;
  camera.far = Math.max(2000, distance * 8);
  controls.minDistance = view === 'departure' ? .15 : .5;
  controls.maxDistance = Math.max(2000, distance * 5);
  camera.updateProjectionMatrix(); camera.lookAt(controls.target); controls.update();
  const names = { full: 'Earth-centered inertial · full trajectory', departure: 'Earth departure · first three hours',
    xy: 'Equatorial projection · X–Y', xz: 'Meridian projection · X–Z', yz: 'Cross-plane projection · Y–Z' };
  $('view-title').textContent = names[view];
  $('view-description').textContent = view === 'departure'
    ? '19 Oct 21:00 → 20 Oct 00:00 UTC · true Earth scale · camera detail'
    : 'ICRF equatorial axes · true spatial scale · geometric states';
  for (const button of $('views').querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.view === view);
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  updateScene();
}

function resize() {
  if (!renderReady) return;
  const w = $('scene').clientWidth, h = $('scene').clientHeight;
  if (!w || !h || (w === lastWidth && h === lastHeight)) return;
  lastWidth = w; lastHeight = h;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  for (const material of lineMaterials) material.resolution.set(w, h);
  fitCamera(state.view);
}

function setupScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', 'Three-dimensional ECI scene. Use camera presets for keyboard navigation.');
  $('scene').prepend(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color(C.surface);
  camera = new THREE.PerspectiveCamera(38, 1, .02, 5000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches; controls.dampingFactor = .1; controls.zoomSpeed = .9;
  controls.addEventListener('start', () => {
    $('view-title').textContent = 'Earth-centered inertial · free camera';
    $('view-description').textContent = 'ICRF equatorial axes · camera orbit / pan / zoom · true spatial scale';
  });
  labelLayer = document.createElement('div'); labelLayer.className = 'label-layer'; $('scene').appendChild(labelLayer);
  scene.add(new THREE.AmbientLight(0xffffff, .22));
  sunLight = new THREE.DirectionalLight(0xffffff, 2.3); scene.add(sunLight); scene.add(sunLight.target);
  const image = $('earth-texture');
  const texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (image.complete) texture.needsUpdate = true;
  else image.addEventListener('load', () => { texture.needsUpdate = true; }, { once: true });
  earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshPhongMaterial({ map: texture, shininess: 5, specular: 0x151b22 }));
  scene.add(earth);
  moon = new THREE.Mesh(new THREE.SphereGeometry(M.moon_radius_km / M.earth_radius_km, 32, 16), new THREE.MeshLambertMaterial({ color: C.moon }));
  scene.add(moon);
  const trajectory = makeLine(D.states.mmx.map(vector), C.blue, { width: 2.3 });
  scene.add(trajectory);
  moonPath = makeLine(D.states.moon.filter((_, i) => i % 10 === 0).map(vector), C.moon, { dashed: true, width: 1.5, opacity: .65 });
  scene.add(moonPath);
  earthMarker = pointMarker(C.blue, 10, false); scene.add(earthMarker);
  mmxMarker = pointMarker(C.pale, 13); scene.add(mmxMarker);
  moonMarker = pointMarker(C.moon, 9); scene.add(moonMarker);
  addLabel('Earth', () => new THREE.Vector3(), 'earth', [-34, -22]);
  addLabel('MMX', () => mmxMarker.position, 'mmx', [11, 9]);
  addLabel('Moon', () => moon.position, 'moon', [12, -15]);
  dayGroup = new THREE.Group(); scene.add(dayGroup);
  for (let day = 1; day <= 6; day++) {
    const p = vector(D.states.mmx[day * 1440]);
    const mark = pointMarker(C.blue, 8); mark.position.copy(p); dayGroup.add(mark);
    addLabel(`${19 + day} Oct`, () => p, 'day', [9, -17]);
  }
  departureGroup = new THREE.Group(); scene.add(departureGroup);
  for (let hour = 1; hour <= 3; hour++) {
    const p = vector(D.states.mmx[hour * 60]);
    const mark = pointMarker(C.pale, 8); mark.position.copy(p); departureGroup.add(mark);
    addLabel(hour === 3 ? '20 Oct 00:00' : `${21 + hour}:00 UTC`, () => p, 'hour', [10, -17]);
  }
  axesGroup = new THREE.Group(); scene.add(axesGroup);
  const length = 55;
  for (const [name, a] of [['+X', [1, 0, 0]], ['+Y', [0, 0, -1]], ['+Z', [0, 1, 0]]]) {
    const p = new THREE.Vector3(...a).multiplyScalar(length);
    axesGroup.add(makeLine([new THREE.Vector3(), p], C.grid, { width: 1 }));
    addLabel(name, () => p.clone().multiplyScalar(axesGroup.scale.x), 'axis', [5, -15]);
  }
  renderReady = true;
  resizeObserver = new ResizeObserver(resize); resizeObserver.observe($('scene'));
  resize(); updateScene();
  const saved = (query.get('cam') || '').split(',').map(Number);
  if (saved.length === 9 && saved.every(Number.isFinite) && Math.hypot(...saved.slice(0, 3)) < 20000
    && Math.hypot(...saved.slice(3, 6)) < 10000 && Math.hypot(...saved.slice(6)) > .1) {
    const pos = new THREE.Vector3(...saved.slice(0, 3));
    const target = new THREE.Vector3(...saved.slice(3, 6));
    if (pos.distanceTo(target) > .05) {
      camera.position.copy(pos); controls.target.copy(target); camera.up.set(...saved.slice(6)).normalize();
      camera.lookAt(target); controls.update();
      $('view-title').textContent = 'Earth-centered inertial · restored camera';
      $('view-description').textContent = 'ICRF equatorial axes · shared camera position · true spatial scale';
    }
  }
  $('loading').hidden = true;
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); $('render-error').hidden = false;
    $('render-error-detail').textContent = 'The graphics context was lost. Reload the page to restore the scene.';
    renderReady = false; setPlaying(false);
  });
}

const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
function updateScene() {
  earth.quaternion.copy(q0.fromArray(D.earth_quaternion_xyzw[current.i]))
    .slerp(q1.fromArray(D.earth_quaternion_xyzw[current.i + 1]), current.u);
  mmxMarker.position.copy(vector(current.mmx));
  moon.position.copy(vector(current.moon)); moonMarker.position.copy(moon.position);
  sunLight.position.copy(vector(current.sun));
  moon.visible = moonMarker.visible = moonPath.visible = state.moon;
  axesGroup.visible = state.axes; axesGroup.scale.setScalar(state.view === 'departure' ? .12 : 1);
  dayGroup.visible = state.labels && state.view !== 'departure';
  departureGroup.visible = state.labels && state.view === 'departure';
  earthMarker.visible = camera.position.length() > 25;
  const departureOutside = state.view === 'departure' && state.t > 10800;
  $('scene-hint').textContent = departureOutside ? 'Selected epoch lies beyond the departure detail.' : 'Earth rotates; the reference frame does not.';
}

function positionLabels() {
  const w = $('scene').clientWidth, h = $('scene').clientHeight;
  const placed = [];
  for (const label of labels) {
    const p = label.getPosition();
    const ndc = p.clone().project(camera);
    let visible = state.labels && ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) < .96 && Math.abs(ndc.y) < .91;
    if (label.kind === 'moon') visible &&= state.moon;
    if (label.kind === 'axis') visible &&= state.axes;
    if (label.kind === 'day' && state.view === 'departure') visible = false;
    if (label.kind === 'hour' && state.view !== 'departure') visible = false;
    const ray = p.clone().sub(camera.position), d2 = ray.lengthSq();
    const closest = d2 ? -camera.position.dot(ray) / d2 : 0;
    if (label.kind !== 'earth' && closest > 0 && closest < 1
      && camera.position.clone().addScaledVector(ray, closest).lengthSq() < .995 ** 2) visible = false;
    label.el.hidden = !visible;
    if (visible) {
      const width = label.el.offsetWidth, height = label.el.offsetHeight;
      const x = Math.max(5, Math.min(w - width - 5, (ndc.x + 1) * w / 2 + label.offset[0]));
      let y = (1 - ndc.y) * h / 2 + label.offset[1];
      for (let attempt = 0; attempt < 4; attempt++) {
        if (!placed.some(r => x < r.x + r.width + 4 && x + width + 4 > r.x && y < r.y + r.height + 3 && y + height + 3 > r.y)) break;
        y += height + 5;
      }
      placed.push({ x, y, width, height });
      label.el.style.transform = `translate(${x}px,${y}px)`;
    }
  }
}

function frame(now) {
  const dt = lastTime === null ? 0 : Math.min(.1, (now - lastTime) / 1000); lastTime = now;
  if (state.playing) {
    current = sample(D, state.t + dt * state.speed); state.t = current.t;
    if (state.t >= duration) setPlaying(false);
    if (renderReady) updateScene();
    if (now - lastUI > 80) { updateUI(); lastUI = now; }
  }
  if (renderReady) {
    controls.update();
    renderer.render(scene, camera);
    positionLabels();
  }
  requestAnimationFrame(frame);
}

function createCharts() {
  const specs = [
    ['earth_range_km', 1e6, 'Earth range · million km', 'earthRange', C.blue],
    ['moon_distance_km', 1e6, 'Moon separation · million km', 'moonDistance', C.orange],
    ['speed_km_s', 1, 'Geocentric speed · km/s', 'speed', C.blue],
  ];
  for (const [key, unit, title, readout, color] of specs) {
    const data = D.metrics[key], max = Math.max(...data) / unit * 1.05, min = 0;
    const x = t => 33 + t / duration * 223, y = v => 64 - (v / unit - min) / (max - min) * 55;
    const path = data.filter((_, i) => i % 8 === 0).map((v, i) => `${i ? 'L' : 'M'}${x(D.elapsed_s[i * 8]).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const figure = document.createElement('figure'); figure.className = 'chart';
    const caption = document.createElement('figcaption'); caption.textContent = title; figure.appendChild(caption);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 266 87');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${title}, 19 to 25 October 2026. All values are also in the data table.`);
    const element = (name, attrs, text) => {
      const el = document.createElementNS(ns, name);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      if (text !== undefined) el.textContent = text;
      svg.appendChild(el); return el;
    };
    for (const v of [0, max / 2, max]) {
      const yy = y(v * unit);
      element('line', { x1: 33, x2: 256, y1: yy, y2: yy, class: 'grid' });
      element('text', { x: 28, y: yy + 3, 'text-anchor': 'end' }, max > 5 ? v.toFixed(0) : v.toFixed(1));
    }
    for (const d of [0, 3, 6]) element('text', { x: x(d * 86400), y: 82, 'text-anchor': 'middle' }, `${19 + d}`);
    const curve = element('path', { d: path, class: 'curve' }); curve.style.stroke = color;
    const cursor = element('line', { x1: 33, x2: 33, y1: 6, y2: 66, class: 'cursor' });
    const point = element('circle', { cx: 33, cy: y(data[0]), r: 4, class: 'point' }); point.style.fill = color;
    const chart = { cursor, point, x, y, key, readout, unit, caption, title }; charts.push(chart);
    const hover = event => {
      const rect = svg.getBoundingClientRect();
      const time = Math.round(Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * 266 - 33) / 223)) * duration / 60) * 60;
      const s = sample(D, time);
      updateCursors(time);
      $('chart-readout').textContent = `${utcAt(D, time).replace('T', ' ')} · Earth ${fmt(s.earthRange)} km · ${s.speed.toFixed(3)} km/s`;
      return time;
    };
    svg.addEventListener('pointermove', hover);
    svg.addEventListener('pointerleave', () => { updateCursors(state.t); $('chart-readout').textContent = 'Hover a plot to inspect; click to select UTC.'; });
    svg.addEventListener('click', event => setTime(hover(event), true));
    figure.appendChild(svg); $('charts').appendChild(figure);
  }
}

function updateCursors(t) {
  const s = sample(D, t);
  for (const chart of charts) {
    chart.cursor.setAttribute('x1', chart.x(t)); chart.cursor.setAttribute('x2', chart.x(t));
    chart.point.setAttribute('cx', chart.x(t)); chart.point.setAttribute('cy', chart.y(s[chart.readout]));
  }
}

let tablePage = 0;
function buildTable() {
  const step = Number($('table-step').value);
  const indices = D.elapsed_s.map((_, i) => i).filter(i => i % step === 0);
  const pages = Math.ceil(indices.length / 100); tablePage = Math.max(0, Math.min(pages - 1, tablePage));
  $('table-page').textContent = `${tablePage + 1} / ${pages} · ${indices.length.toLocaleString()} rows`;
  $('table-prev').disabled = tablePage === 0; $('table-next').disabled = tablePage === pages - 1;
  const fragment = document.createDocumentFragment();
  for (const i of indices.slice(tablePage * 100, tablePage * 100 + 100)) {
    const tr = document.createElement('tr'); tr.tabIndex = 0;
    const cells = [utcAt(D, D.elapsed_s[i]).replace('T', ' '), ...D.states.mmx[i].slice(0, 3).map(x => fmt(x, 3)),
      fmt(D.metrics.earth_range_km[i], 3), fmt(D.metrics.speed_km_s[i], 3), fmt(D.metrics.moon_distance_km[i], 3)];
    for (const value of cells) { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); }
    const select = () => { setTime(D.elapsed_s[i], true); $('data-dialog').close(); };
    tr.addEventListener('click', select); tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
    fragment.appendChild(tr);
  }
  $('data-rows').replaceChildren(fragment);
}

function download(name, text, type) {
  const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showDialog(id) { setPlaying(false); $(id).showModal(); }
$('show-data').addEventListener('click', () => { buildTable(); showDialog('data-dialog'); });
$('close-data').addEventListener('click', () => $('data-dialog').close());
for (const id of ['show-about', 'show-about-side']) $(id).addEventListener('click', () => showDialog('about-dialog'));
$('close-about').addEventListener('click', () => $('about-dialog').close());
$('table-step').addEventListener('change', () => { tablePage = 0; buildTable(); });
$('table-prev').addEventListener('click', () => { tablePage--; buildTable(); });
$('table-next').addEventListener('click', () => { tablePage++; buildTable(); });
$('download-csv').addEventListener('click', () => download('mmx_eci.csv', csvText(D), 'text/csv'));
$('download-json').addEventListener('click', () => download('mmx_ephemeris.json', JSON.stringify(D), 'application/json'));
$('timeline').addEventListener('input', () => setTime(Number($('timeline').value), true));
$('play').addEventListener('click', () => setPlaying(!state.playing));
$('speed').addEventListener('change', () => { state.speed = Number($('speed').value); });
$('start').addEventListener('click', () => setTime(0, true));
$('end').addEventListener('click', () => setTime(duration, true));
$('previous-day').addEventListener('click', () => setTime(state.t - 86400, true));
$('next-day').addEventListener('click', () => setTime(state.t + 86400, true));
$('go-utc').addEventListener('click', () => {
  const date = Date.parse($('utc-input').value + 'Z');
  const t = (date - Date.parse(M.start_utc)) / 1000;
  if (!Number.isFinite(t) || t < 0 || t > duration) { $('utc-message').textContent = 'Choose a UTC epoch inside 19 Oct 21:00 to 25 Oct 21:00.'; return; }
  $('utc-message').textContent = 'Dates and times are UTC throughout.'; setTime(t, true);
});
$('views').addEventListener('click', e => { const view = e.target.dataset.view; if (allowedViews.includes(view)) fitCamera(view, true); });
$('reset-camera').addEventListener('click', () => fitCamera(state.view));
for (const [id, key] of [['show-moon', 'moon'], ['show-axes', 'axes'], ['show-labels', 'labels']]) {
  $(id).addEventListener('change', () => { state[key] = $(id).checked; if (renderReady) updateScene(); });
}
for (const [id, panel, other] of [['toggle-controls', 'controls-panel', 'state-panel'], ['toggle-info', 'state-panel', 'controls-panel']]) {
  $(id).addEventListener('click', () => { $(panel).classList.toggle('open'); $(other).classList.remove('open'); });
}
$('close-controls').addEventListener('click', () => $('controls-panel').classList.remove('open'));
$('close-info').addEventListener('click', () => $('state-panel').classList.remove('open'));
$('copy-link').addEventListener('click', async () => {
  const url = new URL(location.protocol === 'file:' ? 'https://exoplanet5.github.io/MMX/' : location.href);
  url.search = ''; url.searchParams.set('t', Math.round(state.t)); url.searchParams.set('view', state.view);
  if (renderReady) url.searchParams.set('cam', [...camera.position.toArray(), ...controls.target.toArray(), ...camera.up.toArray()].map(v => v.toFixed(5)).join(','));
  try { await navigator.clipboard.writeText(url.href); $('copy-link').textContent = 'Copied'; }
  catch { $('utc-message').textContent = url.href; $('controls-panel').classList.add('open'); }
  setTimeout(() => { $('copy-link').textContent = 'Copy view'; }, 1800);
});
addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea,button,dialog')) return;
  if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
  else if (e.code === 'ArrowRight') setTime(state.t + 3600, true);
  else if (e.code === 'ArrowLeft') setTime(state.t - 3600, true);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });

const validation = D.summary.validation;
$('validation-note').textContent = `60 s samples · ${M.samples.toLocaleString()} states. Midpoint position residual ≤${(validation.max_position_error_km * 1000).toFixed(1)} m against Horizons; this is not flight uncertainty.`;
$('about-validation').textContent = `${M.samples.toLocaleString()} one-minute states, including both endpoints, checked against ${validation.midpoint_count.toLocaleString()} independent 30-second-offset Horizons states. Maximum position residual: ${(validation.max_position_error_km * 1000).toFixed(2)} m. Maximum velocity residual: ${(validation.max_velocity_error_km_s * 1000).toFixed(2)} m/s. DE440s Moon positions differ from seven Horizons checks by at most ${(validation.max_moon_de440s_vs_horizons_km * 1000).toFixed(2)} m.`;
$('about-provenance').textContent = `Retrieved ${M.retrieved_utc}. Raw-response SHA-256: ${M.raw_response_sha256}. Complete requests and source snapshots are in the repository.`;
createCharts(); updateUI();
try { setupScene(); }
catch (error) {
  $('loading').hidden = true; $('render-error').hidden = false;
  $('render-error-detail').textContent = error.message;
  console.error('MMX renderer:', error);
}
window.__mmx = { state, setTime, setPlaying, fitCamera, sample: t => sample(D, t),
  get ready() { return renderReady; }, get camera() { return camera; }, get controls() { return controls; },
  get earth() { return earth; }, meta: M,
  projectedBounds: () => {
    if (!renderReady) return null;
    const p = D.states.mmx.filter((_, i) => i % 30 === 0).map(s => vector(s).project(camera));
    return { x: [Math.min(...p.map(v => v.x)), Math.max(...p.map(v => v.x))], y: [Math.min(...p.map(v => v.y)), Math.max(...p.map(v => v.y))] };
  } };
requestAnimationFrame(frame);
