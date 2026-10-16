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

export function sample(data, seconds) {
  const t = Math.max(0, Math.min(data.meta.duration_s, Number.isFinite(seconds) ? seconds : 0));
  const i = Math.min(data.elapsed_s.length - 2, Math.floor(t / data.meta.step_s));
  const dt = data.elapsed_s[i + 1] - data.elapsed_s[i];
  const u = (t - data.elapsed_s[i]) / dt;
  const states = {};
  for (const name of ['mmx', 'moon', 'sun']) states[name] = hermite(data.states[name][i], data.states[name][i + 1], u, dt);
  return { t, i, u, ...states,
    earthRange: Math.hypot(...states.mmx.slice(0, 3)),
    speed: Math.hypot(...states.mmx.slice(3)),
    moonDistance: Math.hypot(...states.mmx.slice(0, 3).map((x, k) => x - states.moon[k])),
  };
}

export function sceneVector(vector, radius) {
  return [vector[0] / radius, vector[2] / radius, -vector[1] / radius];
}

export function utcAt(data, t) {
  return new Date(Date.parse(data.meta.start_utc) + t * 1000).toISOString().replace('.000Z', 'Z');
}

export function csvText(data) {
  const rows = ['utc,elapsed_s,x_km,y_km,z_km,vx_km_s,vy_km_s,vz_km_s,earth_range_km,speed_km_s,moon_distance_km'];
  for (let i = 0; i < data.elapsed_s.length; i++) {
    rows.push([utcAt(data, data.elapsed_s[i]), data.elapsed_s[i], ...data.states.mmx[i],
      data.metrics.earth_range_km[i], data.metrics.speed_km_s[i], data.metrics.moon_distance_km[i]].join(','));
  }
  return rows.join('\r\n') + '\r\n';
}
