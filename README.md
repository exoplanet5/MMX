# MMX trajectory explorers

**[Earth departure](https://exoplanet5.github.io/MMX/)** · **[Mars transfer](https://exoplanet5.github.io/MMX/transfer.html)** · [Transfer timeline and methods](transfer-study.md)

Two linked, standalone scientific viewers for JAXA's Martian Moons eXploration spacecraft, **JPL Horizons ID −239**. Both show geometric ICRF states and a catalog-based stellar reference.

> **Pre-launch planning ephemeris, not flight reconstruction.** The source is JAXA `20261019_20281231_MMX_V0.2` via JPL Horizons. No flight-prediction covariance or uncertainty envelope was supplied.

## Earth departure

**2026-10-19 21:00:00 → 2026-10-25 21:00:00 UTC**

- The camera is centered on Earth. **Both left-drag and right-drag orbit Earth**, with panning disabled. Saved view links cannot move the pivot away from Earth.
- Full six-day and near-Earth-detail views, plus **Reset to Earth**.
- Right panel: **Earth range, geocentric speed, geometric geocentric right ascension and declination** only.
- **Moon on by default.** Its solid six-day path has an independent checkbox and is **off by default**.
- **RA/Dec grid, stellar background and constellation lines are on by default**, with independent controls.
- The former Cartesian plane presets, inertial-axis layer and scientific-figure links have been removed from the page.

Earth-center distance grows from **8,703.971 km** to **1,776,012.255 km**; geocentric speed decreases from **10.077174 km/s** to **3.227642 km/s**.

## Mars transfer

**2026-10-19 21:00:00 → 2027-08-29 04:57:00 UTC**

- **Sun-centered by default**, zoomed to contain the full Mars reference orbit.
- Earth, Mars, **Jupiter and Saturn**, with an independent solid-orbit layer and an outer-planet-scale preset.
- Left-drag orbits the current pivot; **right-drag pans it through space**, after which left-drag orbits that new pivot. **Reset to Sun** restores the default center and scale.
- Right panel: **heliocentric distance, heliocentric speed and Earth range** only.
- The same optional stellar background, bright-star labels, constellation lines and RA/Dec grid as the Earth page.
- Clickable planning-geometry milestones, UTC playback/scrubbing, state table and full-precision downloads.

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

The background reuses SatObserver-MX's derived **d3-celestial / BSC5 / HYG** catalog: **1,018 stars**, **110 bright-star names**, and **150 constellation polylines**. Grid spacing is **2 hours in RA and 30° in declination**. Stars are rendered at infinity in a separate camera-rotation-only scene, so solar-view panning introduces no false stellar parallax.

The catalog is a rounded J2000 display catalog, without proper-motion correction. It is an orientation reference, not a precision observing chart. An external orbit-view camera does not reproduce the sky seen by an observer at Earth's center; the displayed geocentric RA/Dec values are independently calculated from the Earth-to-MMX vector.

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

`docs/index.html` and `docs/transfer.html` are standalone pages, approximately **5.1 MiB** and **6.6 MiB**. Each embeds its code, data and assets. Double-click either file; keep them beside each other for cross-page navigation. No runtime server, CDN, ephemeris request or login is required.

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

# Explicit network refreshes create new immutable source snapshots.
~/.venvs/astro313/bin/python -I src/ephemeris.py --refresh
~/.venvs/astro313/bin/python -I src/transfer.py --refresh
```

Both Python entry points accept `--snapshot <directory>` and `--kernel <path>`. The transfer pipeline refuses a refresh if the arrival discontinuity has moved or the interpolation tolerance is exceeded; re-study the transfer window rather than silently connecting different planning arcs. Reported results refer to the archived snapshots.

Browser tests use an existing Chrome installation. The macOS default is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; override `CHROME_PATH` elsewhere. They exercise real left/right drag behavior, center locking, free-pan pivots, infinite-distance stellar rendering, layer defaults, page navigation, RA/Dec, endpoints, downloads, saved views, and mobile layouts. Test output is ignored under `test-results/`; use `npm run test:browser -- --screenshots` to capture the desktop/mobile reference views.

## Implementation and deployment

- `src/ephemeris.py`, `src/transfer.py`: raw capture, validation, canonical state exports and scientific fixtures.
- `data/raw/`, `data/transfer_raw/`: immutable Horizons responses, exact queries, retrieval times and hashes.
- `web/app.js`, `web/states.js`, `web/sky.js`: shared viewer, interpolation/coordinate math and stellar scene.
- `web/index.template.html`, `scripts/build_site.mjs`: build both linked, self-contained pages.
- `web/assets/stars.json`: attributed, rounded stellar reference derived from SatObserver.
- `docs/`: published pages, data and archived figures.

GitHub Pages serves **`main` → `/docs`** at [exoplanet5.github.io/MMX](https://exoplanet5.github.io/MMX/). The existing Apache-2.0 [LICENSE](LICENSE) is retained; third-party MIT/BSD notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the embedded bundles.

**Illustration: Mickey.** Sources: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [JAXA MMX](https://www.mmx.jaxa.jp/en/mission/), and [d3-celestial](https://github.com/ofrohn/d3-celestial). This is an independent study, not an official agency service.
