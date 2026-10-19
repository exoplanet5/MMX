// Topocentric geometry for ground observers. Sites rotate with the same baked Skyfield Earth orientation as the globe.
import { equatorial } from './states.js';

export const WGS84_A = 6378.137, WGS84_E2 = 0.00669437999014;
export const DARK_SUN_DEG = -12, VIEW_ELEVATION_DEG = 15;
const D2R = Math.PI / 180, R2D = 180 / Math.PI, SUN_RADIUS_KM = 695700;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const n = length(a); return [a[0] / n, a[1] / n, a[2] / n]; };
const clamp = x => Math.max(-1, Math.min(1, x));
// Globe-local axes are the scene mapping of ECEF, (x, y, z) -> (x, z, −y); inertial() inverts the ICRF scene mapping.
const local = ([x, y, z]) => [x, z, -y];
const inertial = ([a, b, c]) => [a, -c, b];

export function siteFrame(lat, lon, heightKm = 0) {
  const p = lat * D2R, l = lon * D2R, sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sp * sp);
  return { lat, lon, heightKm, position: local([(n + heightKm) * cp * cl, (n + heightKm) * cp * sl, (n * (1 - WGS84_E2) + heightKm) * sp]),
    up: local([cp * cl, cp * sl, sp]), east: local([-sl, cl, 0]), north: local([-sp * cl, -sp * sl, cp]) };
}

export function rotate([x, y, z, w], a) {
  const t = [2 * (y * a[2] - z * a[1]), 2 * (z * a[0] - x * a[2]), 2 * (x * a[1] - y * a[0])];
  return [a[0] + w * t[0] + y * t[2] - z * t[1], a[1] + w * t[1] + z * t[0] - x * t[2], a[2] + w * t[2] + x * t[1] - y * t[0]];
}

export function slerp(a, b, u) {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const sign = cos < 0 ? -1 : 1; cos *= sign;
  let wa = 1 - u, wb = u * sign;
  if (cos < .9999999) { const theta = Math.acos(cos), s = Math.sin(theta); wa = Math.sin((1 - u) * theta) / s; wb = sign * Math.sin(u * theta) / s; }
  const q = a.map((value, k) => wa * value + wb * b[k]), n = Math.hypot(...q);
  return q.map(value => value / n);
}

export function quaternionAt(data, i, u = 0) {
  const q = data.earth_quaternion_xyzw;
  return u ? slerp(q[i], q[i + 1], u) : q[i];
}

// Site position and local axes in geocentric ICRF at one Earth orientation.
export function orientSite(frame, quaternion) {
  const f = v => inertial(rotate(quaternion, v));
  return { position: f(frame.position), up: f(frame.up), east: f(frame.east), north: f(frame.north) };
}

export function horizontal(site, direction) {
  let az = Math.atan2(dot(direction, site.east), dot(direction, site.north)) * R2D;
  if (az < 0) az += 360;
  return { az, el: Math.asin(clamp(dot(direction, site.up))) * R2D };
}

export function fromHorizontal(site, az, el) {
  const a = az * D2R, e = el * D2R, ce = Math.cos(e);
  return [0, 1, 2].map(k => ce * Math.cos(a) * site.north[k] + ce * Math.sin(a) * site.east[k] + Math.sin(e) * site.up[k]);
}

// Geometric topocentric look angles to a geocentric ICRF position in km.
export function topocentric(site, target) {
  const vector = [target[0] - site.position[0], target[1] - site.position[1], target[2] - site.position[2]];
  const range = length(vector), direction = vector.map(value => value / range);
  return { vector, direction, range, ...horizontal(site, direction), ...equatorial(vector) };
}

export function radecVector(raDeg, decDeg) {
  const ra = raDeg * D2R, dec = decDeg * D2R;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

// Visible fraction of the solar disc from a geocentric position: spherical Earth, straight-limb overlap, no atmosphere.
export function sunlitFraction(position, sun, radius = WGS84_A) {
  const toSun = [sun[0] - position[0], sun[1] - position[1], sun[2] - position[2]];
  const r = length(position), sunDistance = length(toSun);
  const earthRadius = Math.asin(Math.min(1, radius / r)), sunRadius = Math.asin(SUN_RADIUS_KM / sunDistance);
  const separation = Math.acos(clamp(-dot(position, toSun) / (r * sunDistance)));
  const g = separation - earthRadius;
  if (g >= sunRadius) return 1;
  if (g <= -sunRadius) return 0;
  const hidden = sunRadius * sunRadius * Math.acos(g / sunRadius) - g * Math.sqrt(sunRadius * sunRadius - g * g);
  return 1 - hidden / (Math.PI * sunRadius * sunRadius);
}

export function twilight(sunEl) {
  return sunEl >= 0 ? 'day' : sunEl >= -6 ? 'civil twilight' : sunEl >= -12 ? 'nautical twilight' : sunEl >= -18 ? 'astronomical twilight' : 'night';
}

// Look angles at every stored sample; native samples need no interpolation.
export function siteTrack(data, frame) {
  const n = data.elapsed_s.length, az = new Float64Array(n), el = new Float64Array(n), range = new Float64Array(n);
  const direction = new Float64Array(3 * n), sunEl = new Float64Array(n), lit = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const site = orientSite(frame, data.earth_quaternion_xyzw[i]);
    const look = topocentric(site, data.states.mmx[i]);
    az[i] = look.az; el[i] = look.el; range[i] = look.range; direction.set(look.direction, 3 * i);
    sunEl[i] = topocentric(site, data.states.sun[i]).el;
    lit[i] = sunlitFraction(data.states.mmx[i], data.states.sun[i]) >= .5 ? 1 : 0;
  }
  return { az, el, range, direction, sunEl, lit };
}

// Rise/set intervals at the geometric horizon. "Dark" time requires MMX sunlit, at least 15° high, with the Sun below −12°.
export function findPasses(elapsed, track) {
  const { el, sunEl, lit, az } = track, n = elapsed.length, passes = [];
  const crossing = i => elapsed[i - 1] + el[i - 1] / (el[i - 1] - el[i]) * (elapsed[i] - elapsed[i - 1]);
  const dark = i => lit[i] && el[i] >= VIEW_ELEVATION_DEG && sunEl[i] <= DARK_SUN_DEG;
  let first = -1;
  for (let i = 0; i <= n; i++) {
    const up = i < n && el[i] > 0;
    if (up && first < 0) first = i;
    if (up || first < 0) continue;
    const last = i - 1, pass = { first, last, aos: first ? crossing(first) : elapsed[0], los: i < n ? crossing(i) : elapsed[n - 1],
      startsBefore: first === 0, endsAfter: i === n, azRise: az[first], azSet: az[last], darkSeconds: 0, best: null };
    let top = first, bestDark = -1;
    for (let k = first; k <= last; k++) {
      if (el[k] > el[top]) top = k;
      if (dark(k) && (bestDark < 0 || el[k] > el[bestDark])) bestDark = k;
      if (k < last) pass.darkSeconds += (dark(k) + dark(k + 1)) / 2 * (elapsed[k + 1] - elapsed[k]);
    }
    pass.maxEl = el[top]; pass.tMax = elapsed[top];
    if (bestDark >= 0) pass.best = elapsed[bestDark];
    passes.push(pass); first = -1;
  }
  return passes;
}

// Tangent-plane basis for a gnomonic chart: ξ toward increasing RA (east), η toward the north celestial pole.
export function tangentFrame(center) {
  const c = unit(center);
  let east = cross([0, 0, 1], c);
  east = length(east) < 1e-9 ? [0, 1, 0] : unit(east);
  return { center: c, east, north: cross(c, east) };
}

export function gnomonic(frame, direction) {
  const k = dot(direction, frame.center);
  return k > 1e-6 ? [dot(direction, frame.east) / k, dot(direction, frame.north) / k, k] : null;
}

export function fromGnomonic(frame, xi, eta) {
  return unit([0, 1, 2].map(k => frame.center[k] + xi * frame.east[k] + eta * frame.north[k]));
}

// Smallest cap containing the directions, approximated about their normalized mean.
export function enclosingCap(directions) {
  const sum = [0, 0, 0];
  for (const d of directions) { sum[0] += d[0]; sum[1] += d[1]; sum[2] += d[2]; }
  if (length(sum) < 1e-9) return null;
  const center = unit(sum);
  let radius = 0;
  for (const d of directions) radius = Math.max(radius, Math.acos(clamp(dot(d, center))) * R2D);
  return { center, radius };
}
