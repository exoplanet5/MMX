# MMX first-six-day trajectory study

## Scope and source

This study covers **19 October 2026 at 21:00 UTC through 25 October 2026 at 21:00 UTC**. It is the initial Earth-departure segment of a Mars-system mission, not a simulation of Mars arrival, Phobos proximity operations or sample return.

The trajectory is the **JAXA pre-launch planning solution `20261019_20281231_MMX_V0.2`** served by JPL Horizons as spacecraft **−239**. The target description was revised October 7, 2026; the response snapshot was retrieved October 16, 2026. Horizons gives a planned launch time of October 19 at 19:41:03 UTC, so the requested first state is **1 h 18 min 57 s after that planned launch**. No earlier segment is inferred.

The complete raw requests/responses are in [`data/raw/20261016T133031Z_trmg8f7q/`](data/raw/20261016T133031Z_trmg8f7q/). The [provenance file](docs/data/provenance.json) records their hashes, exact query parameters, software versions and the local planetary-kernel checksum.

## What the orbit shows

The spacecraft is already on an outward-moving Earth-escape arc at the first epoch. Its Earth-center distance increases from **8,703.971 km** to **1,776,012.255 km** over six days; its geocentric inertial speed decreases from **10.077174 km/s** to **3.227642 km/s**. At the start, the radial component is **4.947570 km/s**; at the end, it is **3.227120 km/s**, close to the total speed. The initially curved departure becomes nearly radial on the full-window plot.

The initial **Earth-only osculating** eccentricity is **1.168754**, inclination to the ICRF equatorial plane is **30.138126°**, and C3 is **9.958959 km²/s²**. These values characterize the instantaneous state:

\[
C_3 = |\mathbf v|^2 - \frac{2\mu_E}{|\mathbf r|}, \qquad
\mathbf e = \frac{\mathbf v\times(\mathbf r\times\mathbf v)}{\mu_E} - \frac{\mathbf r}{|\mathbf r|}.
\]

The final instantaneous values are **C3 = 9.968801 km²/s²**, **e = 1.291094**, and **i = 30.282828°**. The viewer follows the supplied ephemeris, not one fixed two-body conic. Do not interpret Earth-only elements as constants over an interplanetary departure or attribute every change to a particular maneuver without additional mission information.

### Daily checkpoints

All rows below are at **21:00 UTC**. Distances are center-to-center, not altitude above the surface.

| Date in 2026 | Earth range, km | Speed, km/s | Moon separation, km |
|---|---:|---:|---:|
| October 19 | 8,703.971 | 10.077174 | 399,534.546 |
| October 20 | 350,529.122 | 3.504602 | 742,048.505 |
| October 21 | 645,182.353 | 3.353944 | 1,017,976.138 |
| October 22 | 932,067.462 | 3.296822 | 1,269,955.649 |
| October 23 | 1,215,372.814 | 3.265474 | 1,501,185.421 |
| October 24 | 1,496,492.019 | 3.244310 | 1,713,986.226 |
| October 25 | 1,776,012.255 | 3.227642 | 1,911,515.309 |

**There is no close lunar flyby in this interval.** Moon separation increases at every one-minute sample. Its smallest sampled value, **399,534.546 km**, is at the start boundary. This is a minimum within the requested window, not an identified closest-approach event outside it. The lunar path on the plots is contemporaneous context, not a full orbit or a maneuver target.

## Endpoint vectors

Components are **Earth-centered ICRF equatorial** vectors, with positions in km and velocities in km/s. ICRF is closely aligned with J2000 but is not literally the FK5/J2000 system.

```text
2026-10-19T21:00:00Z
r = (      6603.069744,       4996.517839,       2682.051116) km
v = (        -1.961075,          8.523929,          5.004624) km/s

2026-10-25T21:00:00Z
r = (  -1243152.276993,    1081822.709336,     662156.757127) km
v = (        -2.300321,          1.930181,          1.183468) km/s
```

Quoted digits preserve the numerical source; they are not an accuracy claim. Full precision is retained in [JSON](docs/data/ephemeris.json) and [CSV](docs/data/mmx_eci.csv).

## Ephemeris conventions

The Horizons request explicitly sets:

```text
COMMAND     = '-239'
EPHEM_TYPE  = 'VECTORS'
CENTER      = '500@399'
REF_SYSTEM  = 'ICRF'
REF_PLANE   = 'FRAME'
TIME_TYPE   = 'UT'
VEC_CORR    = 'NONE'
OUT_UNITS   = 'KM-S'
VEC_TABLE   = '2'
STEP_SIZE   = '1 m'
CSV_FORMAT  = 'YES'
```

`REF_PLANE='FRAME'` is essential: the desired equatorial inertial vectors must not be confused with an ecliptic-plane output. For these modern dates, Horizons' UT timestamps are UTC. The downloaded table contains **8,641 samples**, including both endpoints. Julian UT dates are checked against the calendar timestamps.

Moon and Sun context is obtained by subtracting Earth from the simultaneous body states in the shared **DE440s** kernel, after converting UTC to the ephemeris time argument through Skyfield. No `observe()`/apparent-position operation or light-time correction is used. The spacecraft query identifies DE441 for its Earth center; the small difference in local context is explicitly checked rather than claimed to be zero.

## Interpolation and independent checks

The browser uses cubic Hermite interpolation with each endpoint's position and velocity. It computes intermediate velocity from the same interpolant's derivative, then recomputes range, speed and lunar separation from the interpolated vectors. There is no extrapolation beyond the window.

A second Horizons request supplies all **8,640 intervening midpoint states** at 30 seconds after each original sample. Measured maxima are:

| Residual | Value | UTC epoch |
|---|---:|---|
| Position | 5.281026 m | 2026-10-19 21:00:30 |
| Velocity | 2.233434 m/s | 2026-10-19 21:01:30 |
| DE440s Moon position vs. Horizons, seven daily checks | 2.469122 m | Maximum across the seven checks |

These are maxima over the tested midpoint grid, **not rigorous continuous-time error bounds**. They quantify agreement with this planning solution; they do not measure its eventual agreement with flight. In particular, the meter-scale position residual does not justify a meter-scale prediction-accuracy claim.

Python-generated fixtures and JavaScript tests check that both implementations agree, including intermediate states, derived distances, endpoint clamping and CSV precision. Browser checks exercise the actual single-file page with network access blocked and with HTTP project-subpath hosting.

## Visualization choices

- The scientific frame stays inertial. Three.js displays `(X,Y,Z)` as `(X,Z,−Y)/R_E`, a right-handed rotation and uniform scale. The original components are used for all readouts.
- The Earth globe alone rotates through precomputed Earth-fixed-to-ICRF quaternions. Skyfield supplies precession/nutation and UT1 using its bundled timescale data; polar motion is omitted. No hidden IERS/network update occurs during rebuilding.
- The globe's texture orientation is checked against Greenwich, 90° east longitude and the north pole. Lighting uses world-space geometry, avoiding a fixed-versus-inertial Sun-direction mismatch.
- Earth is a sphere of radius **6,378.137 km**, and the Moon has radius **1,737.4 km**. This is not an ellipsoidal topographic model. Separate point markers and labels remain visible when the real radii become subpixel-sized.
- Full-window and early-departure cameras fit different spatial extents; the departure camera is labeled as a three-hour detail. Plane presets are viewing directions, not rotating reference frames.
- Figures use equal spatial scale, a single-hue date ramp, neutral lunar context, and enlarged epoch markers. The diagnostics keep distance and speed on separate vertical axes.

The standalone viewer embeds data, code and a downsampled NASA Blue Marble texture. Its automatic rendering makes no network calls. External links and linked static figures are optional resources, not runtime dependencies.

## Deliverables

- [Interactive ECI viewer](https://exoplanet5.github.io/MMX/)
- [X–Y and X–Z overview](docs/plots/01_eci_overview.png)
- [3D ECI overview](docs/plots/02_eci_3d.png)
- [Near-Earth departure detail](docs/plots/03_departure_zoom.png)
- [Distance and speed history](docs/plots/04_range_speed.png)
- [Machine-readable summary](docs/data/summary.json), [provenance](docs/data/provenance.json), [CSV](docs/data/mmx_eci.csv), [full JSON](docs/data/ephemeris.json)

See [README](README.md) for rebuild/test commands and [third-party notices](THIRD_PARTY_NOTICES.md) for attribution. Sources: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), [Horizons API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [JAXA MMX](https://www.mmx.jaxa.jp/en/mission/). Illustration: Mickey.
