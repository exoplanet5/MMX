import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { sample, sceneVector, utcAt, csvText, solarTerminator, osculating, conicPoints, GM_SUN_KM3_S2 } from './states.js';
import { StellarBackground } from './sky.js';
import { SKY_STYLE } from './sky-style.js';
import { createSkyChart } from './skychart.js';
import { PLACES, DEFAULT_PLACE, placeById } from './places.js';
import { siteFrame, orientSite, quaternionAt, topocentric } from './observer.js';

const $ = id => document.getElementById(id);
const D = JSON.parse($('ephemeris-data').textContent), M = D.meta;
const catalog = JSON.parse($('stellar-data').textContent);
const transfer = M.center_id === 10, unit = transfer ? M.au_km : M.earth_radius_km;
const duration = M.duration_s;
const C = { blue: '#3987e5', pale: '#a1d4fc', moon: '#c1c7ce', orange: '#d95926', ink: '#e8eaed', surface: SKY_STYLE.background, terminator: '#b09025' };
const fmt = (value, digits = 0) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const vector = value => new THREE.Vector3(...sceneVector(value, unit));
const query = new URLSearchParams(location.search);
const allowedViews = transfer ? ['inner', 'outer'] : ['departure', 'full', 'asia'];
const initialTime = Number(query.get('t') || 0);
const state = { t: Number.isFinite(initialTime) ? Math.max(0, Math.min(duration, initialTime)) : 0,
  playing: false, speed: transfer ? 86400 : 3600,
  view: allowedViews.includes(query.get('view')) ? query.get('view') : allowedViews[0],
  moon: true, moonOrbit: false, planets: true, orbits: true, grid: true, stars: true, constellations: true, labels: true, places: true, osculating: true };
let current = sample(D, state.t), renderer, scene, camera, controls, sky, earth, mmxMarker, earthMarker, sunLight;
let moonPath, earthTerminator, epochGroup, departureGroup, labelLayer, osculatingLine, perigeeMarker, renderReady = false, lastTime = null, lastUI = 0;
// Osculating conic: whole heliocentric ellipse, or the geocentric hyperbola from perigee out to the window's largest range.
const mu = transfer ? GM_SUN_KM3_S2 : M.earth_mu_km3_s2, conicCount = transfer ? 361 : 241;
const conicLimit = transfer ? Infinity : Math.max(...D.metrics.earth_range_km) * 1.05;
const terminatorAxis = new THREE.Vector3(0, 0, 1), terminatorLift = 1.0002;
let lastWidth = 0, lastHeight = 0, cameraEdited = false;
const planetNodes = {}, orbitNodes = {}, lineMaterials = [], labels = [];
// Observer sites appear once Earth is large enough on screen for their labels: tier → minimum Earth radius in CSS pixels.
const PLACE_PIXELS = { 1: 105, 2: 230, 3: 420 }, placeDots = {};
let skyChart = null, chartSite = null, chartFrame = null, siteMarker, sightLine, earthPixels = 0;
const geoLocal = (lat, lon, r = 1) => {
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
  return new THREE.Vector3(r * Math.cos(p) * Math.cos(l), r * Math.sin(p), -r * Math.cos(p) * Math.sin(l));
};

function angularText(degrees, rightAscension = false) {
  const sign = degrees < 0 ? '−' : '+';
  let total = Math.round(Math.abs(degrees) / (rightAscension ? 15 : 1) * 36000) / 10;
  if (rightAscension) total %= 86400;
  const major = Math.floor(total / 3600), minute = Math.floor(total / 60) % 60, second = (total % 60).toFixed(1).padStart(4, '0');
  return rightAscension ? `${String(major).padStart(2, '0')}h${String(minute).padStart(2, '0')}m${second}s`
    : `${sign}${String(major).padStart(2, '0')}°${String(minute).padStart(2, '0')}′${second}″`;
}

function setPlaying(on) {
  if (on && state.t >= duration) setTime(0);
  state.playing = on; $('play').textContent = on ? 'Ⅱ Pause' : '▶ Play';
  $('play').setAttribute('aria-label', on ? 'Pause trajectory' : 'Play trajectory');
}

function setTime(seconds, pause = false) {
  if (pause) setPlaying(false);
  current = sample(D, seconds); state.t = current.t;
  updateUI(); if (renderReady) updateScene();
}

function updateUI() {
  const utc = utcAt(D, Math.floor(state.t));
  $('utc-date').textContent = utc.slice(0, 10); $('utc-time').textContent = utc.slice(11, 19); $('utc-clock').dateTime = utc;
  $('utc-mini').textContent = `${utc.slice(0, 10)} ${utc.slice(11, 19)} UTC`;
  $('timeline').value = state.t; $('timeline').setAttribute('aria-valuetext', utc);
  const days = Math.floor(state.t / 86400), seconds = Math.floor(state.t % 86400);
  $('elapsed').textContent = `Window +${days}d ${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('speed-value').textContent = fmt(current.speed, 3);
  const orbit = osculating(current.mmx, mu, transfer);
  $('orbit-e').textContent = orbit.e.toFixed(5); $('orbit-i').textContent = orbit.inclination.toFixed(3);
  if (transfer) {
    $('helio-value').textContent = fmt(current.heliocentricRange / unit, 5);
    $('range-value').textContent = fmt(current.earthRange);
    $('orbit-a').textContent = (orbit.a / unit).toFixed(5); $('orbit-peri').textContent = (orbit.periapsis / unit).toFixed(5);
    $('orbit-apo').textContent = Number.isFinite(orbit.apoapsis) ? (orbit.apoapsis / unit).toFixed(5) : '—';
    $('orbit-period').textContent = Number.isFinite(orbit.period) ? fmt(orbit.period / 86400, 1) : '—';
  } else {
    $('range-value').textContent = fmt(current.earthRange, 3);
    $('ra-value').textContent = angularText(current.ra_deg, true); $('dec-value').textContent = angularText(current.dec_deg);
    $('orbit-c3').textContent = orbit.c3.toFixed(4); $('orbit-vinf').textContent = orbit.c3 > 0 ? Math.sqrt(orbit.c3).toFixed(4) : '—';
    $('orbit-peri').textContent = fmt(orbit.periapsis, 1); $('orbit-alt').textContent = fmt(orbit.periapsis - unit, 1);
  }
}

function makeLine(points, color, width = 1.6, opacity = 1) {
  const geometry = new LineGeometry(); geometry.setPositions(points.flatMap(p => p.toArray()));
  const material = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, worldUnits: false });
  const line = new Line2(geometry, material); lineMaterials.push(material); return line;
}

function pointMarker(color, size, depthTest = true, diamond = false) {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.beginPath();
  if (diamond) { ctx.moveTo(32, 5); ctx.lineTo(59, 32); ctx.lineTo(32, 59); ctx.lineTo(5, 32); ctx.closePath(); }
  else ctx.arc(32, 32, 23, 0, 2 * Math.PI);
  ctx.fill(); ctx.strokeStyle = C.surface; ctx.lineWidth = 5; ctx.stroke();
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size, sizeAttenuation: false, map,
    transparent: true, depthTest, depthWrite: false, alphaTest: .1 }));
}

function addLabel(text, getPosition, kind = 'fixed', offset = [10, -15]) {
  const el = document.createElement('div'); el.className = 'body-label'; el.textContent = text;
  const label = { el, getPosition, kind, offset }; labelLayer.appendChild(el); labels.push(label); return label;
}

function dotCloud(points, color, size, ring = false) {
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => p.toArray()), 3));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.beginPath(); ctx.arc(32, 32, ring ? 22 : 18, 0, 2 * Math.PI);
  if (ring) { ctx.lineWidth = 9; ctx.strokeStyle = C.surface; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.stroke(); }
  else { ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = C.surface; ctx.stroke(); }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size, sizeAttenuation: false, map, transparent: true, depthWrite: false, alphaTest: .1 }));
}

function openSky(place, focus = false) {
  if (!skyChart) return;
  try { skyChart.open(place, focus); } catch (error) { console.error('MMX sky chart:', error); }
}

function setupPlaces() {
  for (const tier of [1, 2, 3]) {
    const group = PLACES.filter(place => place.tier === tier);
    const cities = dotCloud(group.filter(p => p.kind === 'city').map(p => geoLocal(p.lat, p.lon, 1.002)), '#c1c7ce', 6);
    placeDots[tier] = [cities]; earth.add(cities);
    const stations = group.filter(p => p.kind === 'station');
    if (stations.length) { const ring = dotCloud(stations.map(p => geoLocal(p.lat, p.lon, 1.002)), C.ink, 10, true); placeDots[tier].push(ring); earth.add(ring); }
  }
  // Label priority: major cities, then JAXA facilities, then smaller cities.
  for (const place of [...PLACES].sort((a, b) => a.tier - b.tier || (a.kind === 'station') - (b.kind === 'station'))) {
    const local = geoLocal(place.lat, place.lon, 1.002), world = new THREE.Vector3();
    const label = addLabel(place.name, () => world.copy(local).applyQuaternion(earth.quaternion), 'place', [7, -8]);
    Object.assign(label, { tier: place.tier, place });
    label.el.classList.add('place-label', place.kind);
    label.el.tabIndex = 0; label.el.setAttribute('role', 'button');
    label.el.title = `Sky chart from ${place.name}${place.note ? ` · ${place.note}` : ''}`;
    label.el.addEventListener('click', () => openSky(place));
    label.el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSky(place); } });
  }
  siteMarker = dotCloud([new THREE.Vector3()], C.pale, 16, true); siteMarker.visible = false; scene.add(siteMarker);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  sightLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: C.pale, transparent: true, opacity: .6, depthWrite: false }));
  sightLine.visible = false; sightLine.frustumCulled = false; scene.add(sightLine);
  // A click without dragging picks the nearest labelled site, otherwise the clicked point on the globe.
  const raycaster = new THREE.Raycaster(); let press = null;
  renderer.domElement.addEventListener('pointerdown', e => { press = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
  renderer.domElement.addEventListener('pointerup', e => {
    const click = press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5 && performance.now() - press.t < 700; press = null;
    if (!click) return;
    const rect = renderer.domElement.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
    let best = null, bestDistance = 14;
    for (const label of labels) if (label.kind === 'place' && !label.el.hidden && label.anchor) {
      const d = Math.hypot(label.anchor.x - x, label.anchor.y - y); if (d < bestDistance) { best = label.place; bestDistance = d; }
    }
    if (best) { openSky(best); return; }
    raycaster.setFromCamera(new THREE.Vector2(x / rect.width * 2 - 1, 1 - y / rect.height * 2), camera);
    const hit = raycaster.intersectObject(earth, false)[0];
    if (!hit) return;
    const local = earth.worldToLocal(hit.point.clone()).normalize();
    openSky({ lat: +(Math.asin(local.y) * 180 / Math.PI).toFixed(4), lon: +(Math.atan2(-local.z, local.x) * 180 / Math.PI).toFixed(4), custom: true });
  });
}

function updateSite() {
  if (!siteMarker) return;
  siteMarker.visible = !!chartSite; sightLine.visible = false;
  if (!chartSite) return;
  const site = orientSite(chartFrame, quaternionAt(D, current.i, current.u)), look = topocentric(site, current.mmx);
  const surface = new THREE.Vector3(...sceneVector(site.up, 1)).multiplyScalar(1.003);
  siteMarker.geometry.attributes.position.setXYZ(0, ...surface.toArray()); siteMarker.geometry.attributes.position.needsUpdate = true;
  siteMarker.geometry.computeBoundingSphere();
  if (look.el > 0) {
    const position = sightLine.geometry.attributes.position;
    position.setXYZ(0, ...surface.toArray()); position.setXYZ(1, ...vector(current.mmx).toArray()); position.needsUpdate = true;
    sightLine.visible = true;
  }
}

function radiusForView(view) {
  if (transfer) {
    const names = view === 'outer' ? ['mars', 'jupiter', 'saturn'] : ['mars'];
    return Math.max(...names.flatMap(name => D.orbits[name].position_km.map(p => Math.hypot(...p) / unit))) * 1.04;
  }
  const values = view === 'departure' ? D.states.mmx.slice(0, 181) : D.states.mmx;
  return Math.max(1, ...values.map(p => Math.hypot(...p.slice(0, 3)) / unit));
}

function fitCamera(view, resetEpoch = false) {
  if (!renderReady || !allowedViews.includes(view)) return;
  state.view = view; cameraEdited = false;
  if (!transfer && resetEpoch && view === 'departure' && state.t > 10800) setTime(0, true);
  const vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  controls.target.set(0, 0, 0); camera.up.set(0, 1, 0);
  if (view === 'asia') {
    updateScene();
    // Face central Asia at the selected epoch; the camera stays inertial, so Earth turns beneath it during playback.
    camera.position.copy(geoLocal(30, 108).applyQuaternion(earth.quaternion).multiplyScalar(1.45 / Math.sin(Math.min(vfov, hfov) / 2)));
  } else {
    const distance = radiusForView(view) / Math.sin(Math.min(vfov, hfov) / 2) * 1.1;
    camera.position.copy(new THREE.Vector3(...(transfer ? [.25, 1.3, .75] : [.25, .85, 1.4])).normalize().multiplyScalar(distance));
  }
  camera.lookAt(controls.target); camera.updateProjectionMatrix(); controls.update();
  $('view-title').textContent = transfer ? (view === 'outer' ? 'Sun-centered · outer-planet context' : 'Sun-centered · Earth to Mars')
    : ({ departure: 'Earth-centered · departure detail', asia: 'Earth-centered · Asia ground view' }[view] ?? 'Earth-centered · 19–25 October 2026');
  $('view-description').textContent = transfer ? 'Heliocentric ICRF · distances in AU · stellar reference at infinity'
    : ({ departure: 'First three hours · Earth-locked camera · ICRF stellar reference', asia: 'Click a city, a JAXA station or any point on Earth for its sky chart' }[view]
      ?? 'Earth-locked camera · geometric ICRF · stellar reference at infinity');
  for (const button of $('views').querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset.view === view); button.setAttribute('aria-pressed', String(button.dataset.view === view));
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
  if (!cameraEdited) fitCamera(state.view);
}

function addPlanet(name, radiusKm, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radiusKm / unit, 32, 16), new THREE.MeshLambertMaterial({ color }));
  const marker = pointMarker(color, name === 'sun' ? 17 : 10, name !== 'sun');
  scene.add(mesh, marker); planetNodes[name] = { mesh, marker, radius: radiusKm / unit };
  addLabel(name[0].toUpperCase() + name.slice(1), () => mesh.position, name);
}

function setupScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false; renderer.setClearColor(C.surface);
  renderer.domElement.setAttribute('aria-label', transfer ? 'Sun-centered transfer. Left-drag orbits; right-drag pans.' : 'Earth-centered departure. Both drag buttons orbit around Earth.');
  $('scene').prepend(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, transfer ? .00001 : .002, transfer ? 5000 : 100000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.dampingFactor = .1; controls.zoomSpeed = .9;
  controls.enablePan = transfer;
  controls.mouseButtons.RIGHT = transfer ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  controls.touches.TWO = transfer ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE;
  controls.minDistance = transfer ? .006 : 1.04; controls.maxDistance = transfer ? 500 : 10000;
  controls.addEventListener('start', () => {
    cameraEdited = true;
    $('view-title').textContent = transfer ? 'Heliocentric ICRF · free camera' : 'Earth-centered · orbit camera';
    $('view-description').textContent = transfer ? 'Left-drag orbits the current pivot · right-drag moves that pivot' : 'Earth remains the camera pivot for both drag buttons';
  });
  sky = new StellarBackground(catalog, $('scene'));
  labelLayer = document.createElement('div'); labelLayer.className = 'label-layer'; $('scene').appendChild(labelLayer);
  scene.add(new THREE.AmbientLight(0xffffff, .22));
  mmxMarker = pointMarker(C.pale, 14, true, true); scene.add(mmxMarker);
  addLabel('MMX', () => mmxMarker.position, 'mmx', [11, 9]);
  scene.add(makeLine(D.states.mmx.map(vector), C.blue, 2.3));
  osculatingLine = makeLine(Array.from({ length: conicCount }, () => new THREE.Vector3()), C.pale, 1.2, .7); osculatingLine.frustumCulled = false;
  osculatingLine.material.dashed = true;
  perigeeMarker = pointMarker(C.pale, 7); scene.add(osculatingLine, perigeeMarker);
  if (transfer) {
    sunLight = new THREE.PointLight(0xffffff, 2.3, 0, 0); scene.add(sunLight);
    addPlanet('sun', 695700, '#f2d49b');
    planetNodes.sun.mesh.material = new THREE.MeshBasicMaterial({ color: '#f2d49b' });
    addPlanet('earth', 6378.137, C.blue); addPlanet('mars', 3389.5, C.orange);
    addPlanet('jupiter', 69911, '#c1c7ce'); addPlanet('saturn', 58232, '#c1c7ce');
    for (const [name, orbit] of Object.entries(D.orbits)) {
      const line = makeLine(orbit.position_km.map(vector), C.moon, 1.15, name === 'earth' || name === 'mars' ? .45 : .25);
      scene.add(line); orbitNodes[name] = line;
    }
  } else {
    sunLight = new THREE.DirectionalLight(0xffffff, 2.3); scene.add(sunLight, sunLight.target);
    const image = $('earth-texture'), texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (image.complete) texture.needsUpdate = true; else image.addEventListener('load', () => { texture.needsUpdate = true; }, { once: true });
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshPhongMaterial({ map: texture, shininess: 5, specular: 0x151b22 }));
    scene.add(earth); earthMarker = pointMarker(C.blue, 10, false); scene.add(earthMarker);
    const circle = Array.from({ length: 721 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 360), Math.sin(i * Math.PI / 360), 0));
    earthTerminator = makeLine(circle, C.terminator, 1.5);
    earthTerminator.material.depthWrite = false;
    scene.add(earthTerminator);
    addLabel('Earth', () => earth.position, 'earth', [-35, -22]);
    addPlanet('moon', M.moon_radius_km, C.moon);
    moonPath = makeLine(D.states.moon.filter((_, i) => i % 10 === 0).map(vector), C.moon, 1.3, .65); scene.add(moonPath);
    setupPlaces();
  }
  epochGroup = new THREE.Group(); departureGroup = new THREE.Group(); scene.add(epochGroup, departureGroup);
  const markers = [];
  if (transfer) {
    for (let date = new Date('2026-11-01T00:00:00Z'); date.getTime() < Date.parse(M.end_utc); date.setUTCMonth(date.getUTCMonth() + 1)) {
      markers.push({ t: (date.getTime() - Date.parse(M.start_utc)) / 1000, label: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) });
    }
  } else for (let day = 1; day <= 6; day++) markers.push({ t: day * 86400, label: `${19 + day} Oct` });
  for (const item of markers) {
    const p = vector(sample(D, item.t).mmx), marker = pointMarker(C.blue, 7); marker.position.copy(p); epochGroup.add(marker);
    addLabel(item.label, () => p, 'epoch');
  }
  if (!transfer) for (let hour = 1; hour <= 3; hour++) {
    const p = vector(sample(D, hour * 3600).mmx), marker = pointMarker(C.pale, 8); marker.position.copy(p); departureGroup.add(marker);
    addLabel(hour === 3 ? '20 Oct 00:00' : `${21 + hour}:00 UTC`, () => p, 'hour');
  }
  renderReady = true; new ResizeObserver(resize).observe($('scene')); resize(); updateScene();
  const saved = (query.get('cam') || '').split(',').map(Number);
  if (saved.length === 9 && saved.every(Number.isFinite) && Math.hypot(...saved.slice(0, 3)) < (transfer ? 2000 : 20000)
    && Math.hypot(...saved.slice(3, 6)) < (transfer ? 1000 : 10000) && Math.hypot(...saved.slice(6)) > .1) {
    const position = new THREE.Vector3(...saved.slice(0, 3));
    const target = transfer ? new THREE.Vector3(...saved.slice(3, 6)) : new THREE.Vector3();
    if (position.distanceTo(target) >= controls.minDistance) {
      camera.position.copy(position); controls.target.copy(target); camera.up.set(...saved.slice(6)).normalize();
      camera.lookAt(target); controls.update(); cameraEdited = true;
      $('view-title').textContent = transfer ? 'Heliocentric ICRF · restored camera' : 'Earth-centered · restored camera';
    }
  }
  $('loading').hidden = true;
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); $('render-error').hidden = false;
    $('render-error-detail').textContent = 'Graphics context lost. Reload the page to restore the scene.';
    renderReady = false; setPlaying(false);
  });
}

// Rewrites the fixed-size Line2 segment buffer in place, so playback does not allocate new geometry every frame.
function updateOsculating() {
  osculatingLine.visible = perigeeMarker.visible = state.osculating;
  if (!state.osculating) return;
  const points = conicPoints(osculating(current.mmx, mu), conicCount, conicLimit).map(p => sceneVector(p, unit));
  const buffer = osculatingLine.geometry.attributes.instanceStart.data, array = buffer.array;
  for (let i = 0; i < conicCount - 1; i++) array.set([...points[i], ...points[i + 1]], 6 * i);
  buffer.needsUpdate = true; osculatingLine.geometry.computeBoundingSphere(); osculatingLine.computeLineDistances();
  perigeeMarker.position.set(...points[0]);
}

const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
function updateScene() {
  mmxMarker.position.copy(vector(current.mmx)); updateOsculating();
  if (transfer) {
    for (const name of ['earth', 'mars', 'jupiter', 'saturn']) {
      const node = planetNodes[name]; node.mesh.position.copy(vector(current[name])); node.marker.position.copy(node.mesh.position);
      node.mesh.visible = node.marker.visible = state.planets;
    }
    for (const node of Object.values(orbitNodes)) node.visible = state.orbits;
    $('scene-hint').textContent = controls.target.length() > 1e-7 ? 'Orbiting the panned pivot · Reset to Sun recenters.' : 'Sun at the camera pivot · outer planets available by zooming out.';
  } else {
    earth.quaternion.copy(q0.fromArray(D.earth_quaternion_xyzw[current.i])).slerp(q1.fromArray(D.earth_quaternion_xyzw[current.i + 1]), current.u);
    earthMarker.visible = camera.position.length() > 25;
    planetNodes.moon.mesh.position.copy(vector(current.moon)); planetNodes.moon.marker.position.copy(planetNodes.moon.mesh.position);
    planetNodes.moon.mesh.visible = planetNodes.moon.marker.visible = state.moon;
    moonPath.visible = state.moonOrbit; sunLight.position.copy(vector(current.sun));
    const boundary = solarTerminator(current.sun, M.earth_radius_km);
    earthTerminator.quaternion.setFromUnitVectors(terminatorAxis, new THREE.Vector3(...sceneVector(boundary.normal, 1)));
    // A small radial lift prevents z-fighting; the boundary itself is computed on the surface.
    earthTerminator.position.copy(vector(boundary.center)).multiplyScalar(terminatorLift);
    earthTerminator.scale.setScalar(boundary.radius / unit * terminatorLift);
    $('scene-hint').textContent = state.view === 'departure' && state.t > 10800 ? 'Selected epoch is beyond the three-hour detail.'
      : (state.view === 'asia' ? 'Click a city or any point on Earth for its sky chart.' : 'Earth is always the camera pivot.');
    updateSite(); skyChart?.render();
  }
  departureGroup.visible = state.labels && !transfer && state.view === 'departure';
}

function positionLabels() {
  const w = $('scene').clientWidth, h = $('scene').clientHeight, occupied = [];
  if (!transfer) {
    earthPixels = h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * Math.tan(Math.asin(Math.min(1, 1 / camera.position.length())));
    for (const [tier, dots] of Object.entries(placeDots)) for (const dot of dots) dot.visible = state.places && earthPixels >= PLACE_PIXELS[tier];
  }
  const occluders = transfer ? Object.entries(planetNodes).filter(([name]) => name === 'sun' || state.planets).map(([, p]) => ({ position: p.mesh.position, radius: p.radius }))
    : [{ position: earth.position, radius: 1 }, ...(state.moon ? [{ position: planetNodes.moon.mesh.position, radius: planetNodes.moon.radius }] : [])];
  for (const label of labels) {
    const p = label.getPosition(), ndc = p.clone().project(camera);
    let visible = state.labels && ndc.z > -1 && ndc.z < 1 && Math.abs(ndc.x) < .96 && Math.abs(ndc.y) < .91;
    if (label.kind === 'moon') visible &&= state.moon;
    if (transfer && ['earth', 'mars', 'jupiter', 'saturn'].includes(label.kind)) visible &&= state.planets;
    if (label.kind === 'epoch') visible &&= epochGroup.visible;
    if (label.kind === 'hour' && state.view !== 'departure') visible = false;
    if (label.kind === 'place') visible &&= state.places && earthPixels >= PLACE_PIXELS[label.tier];
    if (label.kind === 'earth') visible &&= earthPixels < 150;
    if (!transfer && label.kind !== 'earth') {
      const ray = p.clone().sub(camera.position), d2 = ray.lengthSq(), f = d2 ? -camera.position.dot(ray) / d2 : 0;
      if (f > 0 && f < 1 && camera.position.clone().addScaledVector(ray, f).lengthSq() < .995 ** 2) visible = false;
    }
    label.el.hidden = !visible;
    if (!visible) continue;
    // Label text never changes, so measure once instead of forcing layout every frame.
    if (!label.size?.[0]) label.size = [label.el.offsetWidth, label.el.offsetHeight];
    const [width, height] = label.size;
    label.anchor = { x: (ndc.x + 1) * w / 2, y: (1 - ndc.y) * h / 2 };
    let x, y;
    const collides = () => occupied.some(r => x < r.x + r.width + 4 && x + width + 4 > r.x && y < r.y + r.height + 3 && y + height + 3 > r.y);
    // Site labels try right, left, above and below their dot before yielding to an earlier label.
    const candidates = label.kind === 'place' ? [label.offset, [-width - 7, -8], [-width / 2, -height - 7], [-width / 2, 6]] : [label.offset];
    for (const [dx, dy] of candidates) { x = Math.max(5, Math.min(w - width - 5, label.anchor.x + dx)); y = label.anchor.y + dy; if (!collides()) break; }
    if ((label.kind === 'epoch' || label.kind === 'hour' || label.kind === 'place') && collides()) { label.el.hidden = true; continue; }
    for (let attempt = 0; attempt < 4 && collides(); attempt++) y += height + 5;
    occupied.push({ x, y, width, height }); label.el.style.transform = `translate(${x}px,${y}px)`;
  }
  sky.positionLabels(w, h, occupied, camera, occluders);
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
    if (!transfer) controls.target.set(0, 0, 0);
    controls.update(); camera.updateMatrixWorld(true);
    epochGroup.visible = state.labels && (transfer ? camera.position.distanceTo(controls.target) < 18 : state.view !== 'departure');
    // Dashes are in world units; scaling them with camera distance keeps them about 12 px long on screen.
    const dash = camera.position.distanceTo(controls.target) * .011;
    osculatingLine.material.dashSize = dash; osculatingLine.material.gapSize = dash * .8;
    renderer.clear(); sky.render(renderer, camera, state); renderer.clearDepth(); renderer.render(scene, camera);
    positionLabels();
    if (transfer) $('scene-hint').textContent = controls.target.length() > 1e-7 ? 'Orbiting the panned pivot · Reset to Sun recenters.' : 'Sun at the camera pivot · zoom out for Jupiter and Saturn.';
  }
  requestAnimationFrame(frame);
}

let tablePage = 0;
function buildTable() {
  const cadence = { daily: 86400, hourly: 3600, all: 0 }[$('table-step').value], indices = [];
  let next = 0;
  for (let i = 0; i < D.elapsed_s.length; i++) if (D.elapsed_s[i] >= next || i === D.elapsed_s.length - 1) {
    indices.push(i); next = cadence ? (Math.floor(D.elapsed_s[i] / cadence) + 1) * cadence : 0;
  }
  const pages = Math.ceil(indices.length / 100); tablePage = Math.max(0, Math.min(pages - 1, tablePage));
  $('table-page').textContent = `${tablePage + 1} / ${pages} · ${indices.length.toLocaleString()} rows`;
  $('table-prev').disabled = tablePage === 0; $('table-next').disabled = tablePage === pages - 1;
  const fragment = document.createDocumentFragment();
  for (const i of indices.slice(tablePage * 100, tablePage * 100 + 100)) {
    const s = sample(D, D.elapsed_s[i]), tr = document.createElement('tr'); tr.tabIndex = 0;
    const cells = transfer ? [utcAt(D, s.t).replace('T', ' '), fmt(s.heliocentricRange / unit, 6), fmt(s.speed, 4), fmt(s.earthRange, 3)]
      : [utcAt(D, s.t).replace('T', ' '), fmt(s.earthRange, 3), fmt(s.speed, 4), angularText(s.ra_deg, true), angularText(s.dec_deg)];
    for (const value of cells) { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); }
    const select = () => { setTime(s.t, true); $('data-dialog').close(); };
    tr.addEventListener('click', select); tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
    fragment.appendChild(tr);
  }
  $('data-rows').replaceChildren(fragment);
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showDialog(id) { setPlaying(false); $(id).showModal(); }
$('show-data').addEventListener('click', () => { buildTable(); showDialog('data-dialog'); });
$('close-data').addEventListener('click', () => $('data-dialog').close());
$('show-about').addEventListener('click', () => showDialog('about-dialog'));
$('close-about').addEventListener('click', () => $('about-dialog').close());
$('table-step').addEventListener('change', () => { tablePage = 0; buildTable(); });
$('table-prev').addEventListener('click', () => { tablePage--; buildTable(); });
$('table-next').addEventListener('click', () => { tablePage++; buildTable(); });
$('download-csv').addEventListener('click', () => download(transfer ? 'mmx_transfer.csv' : 'mmx_eci.csv', csvText(D), 'text/csv'));
$('download-json').addEventListener('click', () => download(transfer ? 'mmx_transfer.json' : 'mmx_ephemeris.json', JSON.stringify(D), 'application/json'));
$('timeline').addEventListener('input', () => setTime(Number($('timeline').value), true));
$('play').addEventListener('click', () => setPlaying(!state.playing));
$('speed').addEventListener('change', () => { state.speed = Number($('speed').value); });
$('start').addEventListener('click', () => setTime(0, true)); $('end').addEventListener('click', () => setTime(duration, true));
$('previous-day').addEventListener('click', () => setTime(state.t - 86400, true)); $('next-day').addEventListener('click', () => setTime(state.t + 86400, true));
$('views').addEventListener('click', e => { if (allowedViews.includes(e.target.dataset.view)) fitCamera(e.target.dataset.view, true); });
$('reset-camera').addEventListener('click', () => fitCamera(allowedViews[0]));
for (const [id, key] of [['show-moon', 'moon'], ['show-moon-orbit', 'moonOrbit'], ['show-planets', 'planets'], ['show-orbits', 'orbits'], ['show-grid', 'grid'], ['show-stars', 'stars'], ['show-constellations', 'constellations'], ['show-labels', 'labels'], ['show-places', 'places'], ['show-osculating', 'osculating']]) {
  if ($(id)) $(id).addEventListener('change', () => { state[key] = $(id).checked; if (renderReady) updateScene(); });
}
for (const [id, panel, other] of [['toggle-controls', 'controls-panel', 'state-panel'], ['toggle-info', 'state-panel', 'controls-panel']])
  $(id).addEventListener('click', () => { $(panel).classList.toggle('open'); $(other).classList.remove('open'); });
$('close-controls').addEventListener('click', () => $('controls-panel').classList.remove('open'));
$('close-info').addEventListener('click', () => $('state-panel').classList.remove('open'));
function shareURL() {
  const url = new URL(location.protocol === 'file:' ? `https://exoplanet5.github.io/MMX/${transfer ? 'transfer.html' : ''}` : location.href);
  url.search = ''; url.searchParams.set('t', Math.round(state.t)); url.searchParams.set('view', state.view);
  if (renderReady) url.searchParams.set('cam', [...camera.position.toArray(), ...controls.target.toArray(), ...camera.up.toArray()].map(v => v.toFixed(7)).join(','));
  if (skyChart?.isOpen() && chartSite) url.searchParams.set('sky', chartSite.id ?? `${chartSite.lat.toFixed(4)},${chartSite.lon.toFixed(4)}`);
  return url;
}
$('copy-link').addEventListener('click', async () => {
  const url = shareURL();
  try { await navigator.clipboard.writeText(url.href); $('copy-link').textContent = 'Copied'; }
  catch { $('share-message').textContent = url.href; $('share-message').hidden = false; $('controls-panel').classList.add('open'); }
  setTimeout(() => { $('copy-link').textContent = 'Copy view'; }, 1800);
});
addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea,button,dialog,[role=button],.skw')) return;
  if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
  else if (e.code === 'ArrowRight') setTime(state.t + (transfer ? 86400 : 3600), true);
  else if (e.code === 'ArrowLeft') setTime(state.t - (transfer ? 86400 : 3600), true);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
updateUI();
if (!transfer) {
  skyChart = createSkyChart({ data: D, catalog, getTime: () => state.t, onJump: t => setTime(t, true),
    onSite: site => { chartSite = site; chartFrame = site && siteFrame(site.lat, site.lon, site.heightKm); if (renderReady) updateSite(); } });
  $('open-sky').addEventListener('click', () => openSky(chartSite ?? placeById(DEFAULT_PLACE), true));
}
try { setupScene(); }
catch (error) { $('loading').hidden = true; $('render-error').hidden = false; $('render-error-detail').textContent = error.message; console.error('MMX renderer:', error); }
if (skyChart && query.get('sky')) {
  const want = query.get('sky'), place = placeById(want), ll = want.split(',').map(Number);
  if (place) openSky(place);
  else if (ll.length === 2 && ll.every(Number.isFinite) && Math.abs(ll[0]) <= 90 && Math.abs(ll[1]) <= 180) openSky({ lat: ll[0], lon: ll[1], custom: true });
}
window.__mmx = { state, mode: transfer ? 'transfer' : 'departure', setTime, setPlaying, fitCamera, sample: t => sample(D, t),
  get ready() { return renderReady; }, get camera() { return camera; }, get controls() { return controls; }, get earth() { return earth; },
  get sky() { return sky; }, get terminator() { return earthTerminator; }, skyChart, shareURL, openSky, places: PLACES,
  get site() { return { marker: siteMarker, sightLine, earthPixels, chartSite }; }, get osculatingLine() { return osculatingLine; },
  orbit: () => osculating(current.mmx, mu, transfer), get planets() { return planetNodes; }, get moonOrbit() { return moonPath; }, get orbits() { return orbitNodes; }, meta: M,
  projectedBounds: () => {
    if (!renderReady) return null;
    const positions = transfer && state.view === 'inner' ? [...D.states.mmx.filter((_, i) => i % 30 === 0), ...D.orbits.mars.position_km]
      : (!transfer && state.view === 'departure' ? D.states.mmx.slice(0, 181) : D.states.mmx.filter((_, i) => i % 30 === 0));
    const p = positions.map(s => vector(s).project(camera));
    return { x: [Math.min(...p.map(v => v.x)), Math.max(...p.map(v => v.x))], y: [Math.min(...p.map(v => v.y)), Math.max(...p.map(v => v.y))] };
  } };
requestAnimationFrame(frame);
