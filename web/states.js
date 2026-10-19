export function hermite(a, b, u, dt) {
  const u2 = u * u, u3 = u2 * u;
  const state = new Array(6);
  for (let k = 0; k < 3; k++) {
    state[k] = (2 * u3 - 3 * u2 + 1) * a[k] + (u3 - 2 * u2 + u) * dt * a[k + 3]
      + (-2 * u3 + 3 * u2) * b[k] + (u3 - u2) * dt * b[k + 3];
    state[k + 3] = ((6 * u2 - 6 * u) * a[k] + (3 * u2 - 4 * u + 1) * dt * a[k + 3]
      + (-6 * u2 + 6 * u) * b[k] + (3 * u2 - 2 * u) * dt * b[k + 3]) / dt;
  }
  return state;
}

export function equatorial(position) {
  const [x, y, z] = position;
  return { ra_deg: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
    dec_deg: Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI };
}

export function sample(data, seconds) {
  const t = Math.max(0, Math.min(data.meta.duration_s, Number.isFinite(seconds) ? seconds : 0));
  const epochs = data.elapsed_s;
  let i;
  if (data.meta.step_s) i = Math.min(epochs.length - 2, Math.floor(t / data.meta.step_s));
  else {
    let low = 0, high = epochs.length - 1;
    while (high - low > 1) { const middle = (low + high) >> 1; if (epochs[middle] <= t) low = middle; else high = middle; }
    i = Math.min(low, epochs.length - 2);
  }
  const dt = epochs[i + 1] - epochs[i], u = (t - epochs[i]) / dt;
  const states = {};
  for (const [name, values] of Object.entries(data.states)) states[name] = hermite(values[i], values[i + 1], u, dt);
  const transfer = data.meta.center_id === 10;
  const geo = states.mmx.slice(0, 3).map((value, k) => value - (transfer ? states.earth[k] : 0));
  const result = { t, i, u, ...states, earthRange: Math.hypot(...geo),
    speed: Math.hypot(...states.mmx.slice(3)), ...equatorial(geo) };
  if (transfer) {
    result.heliocentricRange = Math.hypot(...states.mmx.slice(0, 3));
    result.marsRange = Math.hypot(...states.mmx.slice(0, 3).map((x, k) => x - states.mars[k]));
  } else result.moonDistance = Math.hypot(...states.mmx.slice(0, 3).map((x, k) => x - states.moon[k]));
  return result;
}

export function solarTerminator(sun, radius) {
  const distance = Math.hypot(...sun.slice(0, 3));
  if (!(radius > 0 && Number.isFinite(distance) && distance > radius)) throw new RangeError('Sun must lie outside the globe');
  const normal = sun.slice(0, 3).map(value => value / distance);
  // At the geometric horizon, r · (s − r) = 0, hence r · s = R².
  const offset = radius * radius / distance;
  return { normal, center: normal.map(value => value * offset), radius: Math.sqrt(radius * radius - offset * offset) };
}

export function sceneVector(vector, radius) {
  return [vector[0] / radius, vector[2] / radius, -vector[1] / radius];
}

export function utcAt(data, t) {
  return new Date(Date.parse(data.meta.start_utc) + t * 1000).toISOString().replace('.000Z', 'Z');
}

export function csvText(data) {
  const transfer = data.meta.center_id === 10;
  const rows = [transfer
    ? 'utc,elapsed_s,x_km,y_km,z_km,vx_km_s,vy_km_s,vz_km_s,heliocentric_range_km,speed_km_s,earth_range_km,mars_range_km'
    : 'utc,elapsed_s,x_km,y_km,z_km,vx_km_s,vy_km_s,vz_km_s,earth_range_km,speed_km_s,moon_distance_km'];
  for (let i = 0; i < data.elapsed_s.length; i++) {
    const values = transfer
      ? [data.metrics.heliocentric_range_km[i], data.metrics.speed_km_s[i], data.metrics.earth_range_km[i], data.metrics.mars_range_km[i]]
      : [data.metrics.earth_range_km[i], data.metrics.speed_km_s[i], data.metrics.moon_distance_km[i]];
    rows.push([utcAt(data, data.elapsed_s[i]), data.elapsed_s[i], ...data.states.mmx[i], ...values].join(','));
  }
  return rows.join('\r\n') + '\r\n';
}

export const GM_SUN_KM3_S2 = 132712440041.279, OBLIQUITY_J2000_DEG = 23.4392911;
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Instantaneous two-body conic through a state. Inclination is referred to the ICRF equator, or to the J2000 ecliptic;
// the periapsis/orbit-normal basis P, Q stays in the input frame for drawing.
export function osculating(state, mu, ecliptic = false) {
  const r = state.slice(0, 3), v = state.slice(3, 6), rn = Math.hypot(...r), v2 = vdot(v, v), h = vcross(r, v), hn = Math.hypot(...h);
  const ev = r.map((x, k) => ((v2 - mu / rn) * x - vdot(r, v) * v[k]) / mu), e = Math.hypot(...ev);
  const energy = v2 / 2 - mu / rn, p = hn * hn / mu, P = e > 1e-10 ? ev.map(x => x / e) : r.map(x => x / rn);
  const Q = vcross(h, P).map(x => x / hn), eps = OBLIQUITY_J2000_DEG * Math.PI / 180;
  const hz = ecliptic ? -h[1] * Math.sin(eps) + h[2] * Math.cos(eps) : h[2];
  return { e, p, P, Q, c3: 2 * energy, a: -mu / (2 * energy), inclination: Math.acos(Math.max(-1, Math.min(1, hz / hn))) * 180 / Math.PI,
    periapsis: p / (1 + e), apoapsis: e < 1 ? p / (1 - e) : Infinity, period: e < 1 ? 2 * Math.PI * Math.sqrt((-mu / (2 * energy)) ** 3 / mu) : Infinity,
    trueAnomaly: Math.atan2(vdot(r, Q), vdot(r, P)) };
}
