# MMX trajectory explorers

**[Earth departure](https://exoplanet5.github.io/MMX/)** · **[Mars transfer](https://exoplanet5.github.io/MMX/transfer.html)** · [Transfer timeline and methods](transfer-study.md)

Two linked, standalone scientific viewers for JAXA's Martian Moons eXploration spacecraft, **JPL Horizons ID −239**. Both show geometric ICRF states, the osculating two-body orbit at the selected epoch and a catalog-based stellar reference. The Earth page adds ground-observer sky charts for Asian cities and JAXA stations.

Both pages share one layout: **time controls in the left column** (play, speed, slider, ±1 day, window ends), camera and layer controls below them, and a right panel that starts with the **selected UTC epoch**, followed by the state and osculating-orbit readouts. There is no bottom time bar on desktop; below 980 px wide the time controls become a compact bottom bar so they stay reachable.

> **Pre-launch planning ephemeris, not flight reconstruction.** The source is JAXA `20261019_20281231_MMX_V0.2` via JPL Horizons. No flight-prediction covariance or uncertainty envelope was supplied.

## Mission infographic

[**MMX: Earth to Phobos and back**](docs/infographics/index.html) combines the retrieved outbound transfer with clearly marked concepts for Mars capture, Phobos quasi-satellite operations and Earth return. It includes an original probe illustration and separate **C-SMP coring** and **P-SMP nitrogen-jet sampling** cutaways.

- [PNG, 2880 × 1782 at 180 dpi](docs/infographics/mmx-mission-profile.png) · [SVG](docs/infographics/mmx-mission-profile.svg) · [PDF, 16 × 9.9 inches](docs/infographics/mmx-mission-profile.pdf)
- [Sources and fact notes](docs/infographics/sources.json) · [Figure provenance](docs/infographics/provenance.json)
- Build: `~/.venvs/astro313/bin/python -I scripts/build_infographic.py && node scripts/render_infographic.mjs`.
- The 2030–2031 return and insertion drawings are **schematic**, not spacecraft ephemerides. The blue outbound line uses all 8,503 stored planning states and stops before the arrival-model splice.

## Earth departure

**2026-10-19 21:00:00 → 2026-10-25 21:00:00 UTC**

- The camera is centered on Earth. **Both left-drag and right-drag orbit Earth**, with panning disabled. Saved view links cannot move the pivot away from Earth.
- **Near-Earth detail is the default**, framing the first three hours. A full six-day view is also available; **Reset to Earth** restores near-Earth framing without changing the selected UTC.
- A thin **yellow day–night terminator** follows the selected epoch’s Sun direction on the globe. It uses the geometric solar-center horizon on the spherical Earth, without atmospheric refraction; a tiny rendering offset avoids surface flicker.
- Right panel: **UTC epoch**; **Earth range, geocentric speed, and geometric geocentric RA · Dec on one line**; then the **osculating geocentric orbit** — C3, v∞, eccentricity, equatorial inclination, perigee radius and altitude.
- **Osculating geocentric orbit (on by default):** a dashed pale-blue Earth two-body hyperbola through the selected state, drawn from perigee out to 1.05 × the window's largest range, with a perigee dot. It is an instantaneous conic, not a propagated orbit; Sun and Moon perturbations change it over the window (e from 1.1688 to 1.2911, C3 from 9.959 to 9.969 km²/s²).
- **Moon on by default.** Its solid six-day path has an independent checkbox and is **off by default**.
- **RA/Dec grid, stellar background and constellation lines are on by default**, with independent controls.

Earth-center distance grows from **8,703.971 km** to **1,776,012.255 km**; geocentric speed decreases from **10.077174 km/s** to **3.227642 km/s**.

### Ground sky chart

Choose **Asia ground view**, then click any of **83 Asian cities or three JAXA facilities** (Misasa 54 m deep-space station, Uchinoura, Tanegashima) or any other point on Earth; the left-panel button opens Misasa. Labels appear by importance as Earth grows on screen and avoid overlap. The selected site gets a ring on the globe and, while MMX is above its horizon, a line of sight. The floating, draggable window follows the SatObserver-MX / CZ-6A layout: site picker and latitude/longitude entry, toolbar, HUD and clickable pass chips.

**Why a partial-sky chart by default.** MMX's geocentric angular rate is about 208°/h at the window start but only 1.3°/h after six hours, 0.13°/h after one day and 0.007°/h at the end, while the sky turns 15°/h. After the first hours an all-sky alt-az track therefore mostly retraces a star's diurnal arc. The default **Field** view is a star-fixed **gnomonic RA/Dec chart** framed on the selected pass (Auto: 20°–80°; fixed 5°–80°; mouse wheel zooms). It shows Hipparcos stars, names and constellations, the topocentric six-day path with its **daily parallax loops** (Earth's radius subtends about 1.0° at one day's range and 0.2° at the end), the selected pass with UTC ticks, the **ground below the geometric horizon**, a dashed **15° elevation line** and compass points along the horizon. North-up or zenith-up orientation, centring on MMX and the east/west flip are toggles. **All-sky** keeps the SatObserver polar alt-az locator, with the field outline.

Pass chips list each rise/set (geometric horizon) in UTC, maximum elevation, and **dark-sky time**: MMX sunlit, at least 15° high and the site's Sun at or below −12°. Clicking a chip jumps to the highest dark-sky epoch, or culmination. From Tokyo, for example, MMX rises around 14:45 UTC and sets near 04:55 UTC each day after the first, with about 3 h 50 min of dark-sky visibility before dawn. MMX begins the window in Earth's shadow and enters sunlight at 21:08 UTC.

Sites rotate with the same Skyfield Earth-orientation quaternions as the globe; WGS84 heights are used (Misasa 1,580 m). Look angles agree with an independent Skyfield/ITRS reference to better than 10⁻⁸°. Directions are geometric: no refraction, aberration or light time, and MMX brightness is not predicted. City coordinates are approximate centres. `?sky=tokyo` or `?sky=lat,lon` opens a chart; **Copy view** records it.

## Mars transfer

**2026-10-19 21:00:00 → 2027-08-29 04:57:00 UTC**

- **Sun-centered by default**, zoomed to contain the full Mars reference orbit.
- Earth, Mars, **Jupiter and Saturn**, with an independent solid-orbit layer and an outer-planet-scale preset.
- Left-drag orbits the current pivot; **right-drag pans it through space**, after which left-drag orbits that new pivot. **Reset to Sun** restores the default center and scale.
- Right panel: **UTC epoch**; **heliocentric distance, heliocentric speed and Earth range**; then the **osculating heliocentric orbit** — semimajor axis, eccentricity, perihelion, aphelion, J2000-ecliptic inclination and period.
- **Osculating heliocentric orbit (on by default):** the dashed Sun two-body ellipse through the selected state (GM☉ from DE440), with a perihelion dot. In mid-cruise it is about **0.99 × 1.55 AU, e ≈ 0.22, i ≈ 0.5°, period ≈ 523 days**; planetary perturbations change it slowly.
- The same optional stellar background, bright-star labels, constellation lines and RA/Dec grid as the Earth page.
- UTC playback/scrubbing, state table and full-precision downloads. The milestone list moved out of the interface into the table below.

**Why the window ends at 04:57:** the planning ephemeris has a large position discontinuity between **04:57 and 04:58 UTC on August 29**. The transfer page stops before this splice; it does not invent a continuous capture maneuver. Horizons describes arrival only as **August 2027**. This sampled model boundary is **not an official orbit-insertion timestamp**.

### Transfer timeline

Times below are geometry estimates from the planning ephemeris, not operational commitments.

| UTC | Milestone |
|---|---|
| 2026-10-19 21:00 | First displayed Earth-departure state |
| 2027-07-21 about 14:48 | Cruise heliocentric maximum, approximately **1.5499 AU** |
| 2027-08-24 about 21:35 | Inbound crossing of **1,000,000 km** from Mars |
| 2027-08-28 about 19:47 | Inbound crossing of **100,000 km** from Mars |
| 2027-08-29 04:57 | Final continuous inbound sample shown; immediately before the arrival-model splice |

## Stellar reference and coordinate conventions

The field follows the Roman sky-track chart: **9,827 Hipparcos stars with V < 6.6**, neutral-white magnitude-scaled points, and thin rings around stars brighter than V = 1.6. Marker area follows `0.55 × (6.9 − V)^2.3` in points²; its square root is converted to CSS-pixel diameter, with a subpixel visibility floor. Opacity follows `clamp(0.25 + 0.115 × (6.6 − V), 0.25, 1)`. Pixel density affects raster resolution, not apparent CSS size.

**110 bright-star names**, **150 constellation polylines**, and constellation-name labels come from SatObserver-MX's derived **d3-celestial / BSC5 / HYG** catalog. Grid spacing is **1 hour in RA and 15° in declination**. Stars are rendered at infinity in a separate camera-rotation-only scene, so solar-view panning introduces no false stellar parallax.

Hipparcos coordinates are ICRS directions at catalog epoch **J1991.25**; the SatObserver overlays use rounded J2000 directions. Neither is propagated with proper motion. This is an orientation reference, not a precision observing chart. An external orbit-view camera does not reproduce the sky seen by an observer at Earth's center; the displayed geocentric RA/Dec values are independently calculated from the Earth-to-MMX vector.

- **Axes:** ICRF equatorial inertial, closely aligned with J2000; not ecliptic or Earth-fixed.
- **Earth page origin:** Earth center, Horizons `CENTER='500@399'`.
- **Transfer origin:** Sun center, Horizons `CENTER='500@10'`.
- **Both queries:** `REF_PLANE='FRAME'`, `REF_SYSTEM='ICRF'`, `TIME_TYPE='UT'` (UTC here), `VEC_CORR='NONE'`, `OUT_UNITS='KM-S'`, `VEC_TABLE='2'`.
- **Display mapping:** `(X,Y,Z) → (X,Z,−Y)`, uniformly scaled by Earth's radius or the astronomical unit. It is right-handed and does not alter reported coordinates.
- **RA/Dec:** `atan2(Y,X)` wrapped to 0–24 hours; `atan2(Z,hypot(X,Y))` in degrees. These are geometric, not light-time/apparent coordinates.
- **Planetary context:** simultaneous DE440s states. Earth uses its center; Mars, Jupiter and Saturn use their system barycenters. Transfer orbit lines trace one nominal orbital period from the start epoch, not merely the transfer dates.
- **Earth texture:** NASA Blue Marble; only the globe rotates, using baked Skyfield Earth-orientation quaternions. Polar motion is omitted. Visibility markers are enlarged independently of physical radii.

## Data and verification

| Dataset | Stored states | Independent midpoint checks | Maximum checked position residual | Maximum checked velocity residual |
|---|---:|---:|---:|---:|
| Earth departure | 8,641 | 8,640 | 5.281 m | 2.233 m/s |
| Mars transfer | 8,503 | 8,502 | 1.477 km | 5.988 m/s |

The Earth page has uniform 60-second sampling. The transfer uses 60 seconds for the first six hours, one hour through cruise, five minutes during the last approach, and 60 seconds during the terminal inbound hour. Both use cubic Hermite interpolation from positions and velocities, with derivative velocities and no extrapolation. These residuals are **agreement checks against the planning ephemeris**, not flight-accuracy claims or rigorous continuous-time error bounds.

Downloads:

- Earth: [CSV](docs/data/mmx_eci.csv), [JSON](docs/data/ephemeris.json), [provenance](docs/data/provenance.json).
- Transfer: [CSV](docs/data/mmx_transfer.csv), [JSON](docs/data/transfer.json), [summary/timeline](docs/data/transfer_summary.json), [provenance](docs/data/transfer_provenance.json).
- Original departure analysis and static plots remain available in [study.md](study.md) and `docs/plots/`, outside the streamlined viewer interface.

## Open locally or rebuild

`docs/index.html` and `docs/transfer.html` are standalone pages, approximately **5.5 MiB** and **6.9 MiB**. Each embeds its code, data and assets. Double-click either file; keep them beside each other for cross-page navigation. No runtime server, CDN, ephemeris request or login is required.

Use the shared **`~/JPLDE/de440s.bsp`** kernel; never copy a planetary kernel into this repository. The default Python is `~/.venvs/astro313/bin/python`. Pinned dependencies are in `requirements.txt` and the npm lockfile.

```sh
# Offline rebuilds from the archived snapshots.
~/.venvs/astro313/bin/python -I src/ephemeris.py
~/.venvs/astro313/bin/python -I src/transfer.py

npm ci --ignore-scripts
npm run build

# Numerical, geometry, interpolation and browser checks.
~/.venvs/astro313/bin/python -I -m unittest discover -s tests -p 'test_*.py'
npm test
npm run test:browser

# Regenerate the independent Skyfield topocentric reference used by tests/observer.test.mjs.
~/.venvs/astro313/bin/python -I scripts/observer_fixtures.py

# Explicit network refreshes create new immutable source snapshots.
~/.venvs/astro313/bin/python -I src/ephemeris.py --refresh
~/.venvs/astro313/bin/python -I src/transfer.py --refresh
```

Both Python entry points accept `--snapshot <directory>` and `--kernel <path>`. The transfer pipeline refuses a refresh if the arrival discontinuity has moved or the interpolation tolerance is exceeded; re-study the transfer window rather than silently connecting different planning arcs. Reported results refer to the archived snapshots.

Browser tests use an existing Chrome installation. The macOS default is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; override `CHROME_PATH` elsewhere. They exercise real left/right drag behavior, center locking, free-pan pivots, infinite-distance stellar rendering, layer defaults, page navigation, RA/Dec, osculating conics, city and globe-click sky charts, pass chips, `?sky=` links, endpoints, downloads, saved views, and mobile layouts. Test output is ignored under `test-results/`; use `npm run test:browser -- --screenshots` to capture the desktop/mobile reference views.

## Implementation and deployment

- `src/ephemeris.py`, `src/transfer.py`: raw capture, validation, canonical state exports and scientific fixtures.
- `data/raw/`, `data/transfer_raw/`: immutable Horizons responses, exact queries, retrieval times and hashes.
- `web/app.js`, `web/states.js`, `web/sky.js`, `web/sky-style.js`: shared viewer, interpolation/coordinate math, osculating conics, geometric terminator, stellar scene and magnitude styling.
- `web/observer.js`, `web/skychart.js`, `web/places.js`: ground-site geometry and pass search, the sky-chart window, and the Asian city / JAXA facility catalog.
- `web/index.template.html`, `scripts/build_site.mjs`: build both linked, self-contained pages.
- `web/assets/hipparcos.json`: the Roman chart's Hipparcos field, with HIP identifiers, catalog epoch and source hash. To reimport the reference CSV, run `~/.venvs/astro313/bin/python -I scripts/import_hipparcos.py /path/to/hip_bright.csv`.
- `web/assets/stars.json`: attributed, rounded names and constellation overlays derived from SatObserver.
- `docs/`: published pages, data and archived figures.

GitHub Pages serves **`main` → `/docs`** at [exoplanet5.github.io/MMX](https://exoplanet5.github.io/MMX/). The existing Apache-2.0 [LICENSE](LICENSE) is retained; third-party MIT/BSD notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the embedded bundles.

**Illustration: Mickey.** Sources: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [JAXA MMX](https://www.mmx.jaxa.jp/en/mission/), and [d3-celestial](https://github.com/ofrohn/d3-celestial). This is an independent study, not an official agency service.
