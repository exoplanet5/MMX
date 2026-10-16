# MMX Earth-to-Mars transfer study

## Selected interval

The [Mars-transfer viewer](https://exoplanet5.github.io/MMX/transfer.html) uses **2026-10-19 21:00:00 through 2027-08-29 04:57:00 UTC**, a duration of **313 days, 7 hours and 57 minutes**.

Horizons target **−239** identifies JAXA's pre-launch planning trajectory **`20261019_20281231_MMX_V0.2`**, revised October 7, 2026. The larger ephemeris begins at **2026-10-19 20:57:30 UTC** and reports coverage through **December 31, 2028**. The displayed start matches the existing Earth-departure page. It is later than the source's planned launch time, **19:41:03 UTC**; no ascent or pre-coverage trajectory is extrapolated.

The source description states **Mars arrival in August 2027**, without an officially timed insertion event. This study chooses its end from the numerical planning arc, not from an inferred flight commitment.

## Why the transfer ends before the arrival splice

A dedicated one-minute Horizons query covers **August 29, 04:55–05:00 UTC**. Between **04:57 and 04:58**:

- The heliocentric position changes by **7,184.188 km in 60 seconds**.
- The displacement differs from trapezoidal integration of the reported endpoint velocities by **8,106.709 km**.
- The Mars-barycentric range changes from **3,892.020 km** to **9,275.906 km**.

This is a discontinuous transition between planning arcs, not a resolved physical burn. A continuous interpolating curve across it would invent motion and misleading encounter geometry. The viewer therefore ends at **04:57**, and its data arrays contain no post-splice state. The range quoted for that last state is a **distance from the Mars system barycenter**, not altitude; it is not asserted to be the actual minimum range of an approach.

The raw boundary response, its query and checksum are preserved with the transfer snapshot. See [transfer provenance](docs/data/transfer_provenance.json) and the [machine-readable boundary report](docs/data/transfer_summary.json).

## Timeline from the planning geometry

| UTC, approximately | Event | Meaning |
|---|---|---|
| 2026-10-19 21:00 | Earth departure | First displayed sample, shared with the Earth-centered page |
| 2027-07-21 14:48 | Cruise aphelion | Maximum heliocentric distance, **1.5499 AU** |
| 2027-08-24 21:35 | 1,000,000 km from Mars | Inbound distance threshold |
| 2027-08-28 19:47 | 100,000 km from Mars | Inbound distance threshold |
| 2027-08-29 04:57 | Arrival-model boundary | Last displayed inbound state before the discontinuity |

Aphelion is located by a zero of **r · v** in the heliocentric interpolant. Distance thresholds are roots of the simultaneous MMX–Mars separation minus the stated radius. Stored timestamps have second-level numerical precision, but the table deliberately rounds geometry estimates to minutes. These are descriptive milestones; no maneuver command, launch/arrival guarantee or flight-prediction uncertainty follows from that precision.

### Endpoint diagnostics

| Quantity | First state | Last state |
|---|---:|---:|
| Heliocentric distance | 149,002,185.870 km | 228,863,919.846 km |
| Heliocentric speed | 39.642310 km/s | 20.068500 km/s |
| Earth-center range | 8,703.971 km | 289,013,688.291 km |

The large initial heliocentric speed includes the spacecraft's near-Earth departure velocity. It should not be confused with geocentric speed, which the Earth-departure page reports separately.

## Retrieval, sampling and interpolation

The spacecraft query explicitly uses:

```text
COMMAND=-239          EPHEM_TYPE=VECTORS
CENTER=500@10         REF_SYSTEM=ICRF
REF_PLANE=FRAME       TIME_TYPE=UT
VEC_CORR=NONE         OUT_UNITS=KM-S
VEC_TABLE=2           CSV_FORMAT=YES
```

The origin is the **Sun center**, the axes are **ICRF equatorial inertial**, and states are geometric with no light-time or aberration correction. Horizons' UT timestamps mean UTC for this interval. Position is stored in km and velocity in km/s; the viewer also expresses heliocentric distance in AU, using **149,597,870.7 km/AU**.

The canonical transfer dataset has **8,503 states** with explicit, strictly increasing epoch offsets:

| Segment | Cadence |
|---|---:|
| First six hours, through October 20 at 03:00 UTC | 60 seconds |
| Cruise through August 27 at 00:00 UTC | 1 hour |
| Approach through August 29 at 04:00 UTC | 5 minutes |
| Final inbound 57 minutes | 60 seconds |

Coincident segment endpoints are checked and deduplicated. Cubic Hermite interpolation uses supplied position and velocity; intermediate velocity is its derivative. Ranges are recomputed from the interpolated vectors. A binary interval search handles the changing cadence. Requests outside the selected time interval cannot produce extrapolated states.

An independent offset grid supplies **8,502 midpoint states**. Maximum checked residuals are:

- **Position: 1.476528 km**, at 2027-02-26 23:30 UTC.
- **Velocity: 5.988352 m/s**, at 2027-08-29 04:56:30 UTC.

These are sample-grid interpolation checks relative to this planning ephemeris, not rigorous continuous-time bounds and not estimates of actual flight prediction error. The pipeline checks the arrival splice on every rebuild and refuses to silently adopt a changed transition.

## Planetary context and reference orbits

The shared **JPL DE440s** kernel supplies simultaneous geometric Sun-relative states for Earth and the Mars, Jupiter and Saturn systems. UTC epochs are converted through Skyfield's built-in timescale to the proper ephemeris time argument. No new planetary kernel is downloaded or copied into the project.

Earth is represented by its center (**399**). Mars, Jupiter and Saturn use **system barycenters 4, 5 and 6**, because the shared kernel does not contain their planet-center satellite-system segments. This distinction is retained in the metadata. Horizons identifies DE441 for its Sun-center state, while the contextual planet vectors here use DE440s.

The optional solid reference orbits are geometric heliocentric tracks over one nominal period starting at the first displayed epoch: approximately **365.256, 686.980, 4,332.59 and 10,759.22 days**, respectively. They are not orbit fits to MMX and do not imply that the transfer viewer covers those full time spans. The tracks are not artificially closed if their ephemeris endpoints differ slightly.

The default camera fits Mars's reference orbit around the Sun. Jupiter and Saturn remain part of the scene and become visible by zooming out or choosing the outer-planet preset. Right-drag translates the viewing pivot; left-drag then orbits that pivot. Reset to Sun restores the origin and inner-system scale.

## Stellar reference

Both pages share **1,018 rounded catalog stars**, **110 proper-name labels** and **150 constellation polylines** from the SatObserver-MX-derived d3-celestial catalog. RA/Dec grid spacing is **2 hours / 30°**. Star size and intensity depend on catalog magnitude; no random decorative stars are added.

The stellar scene has a camera fixed at its own origin and copies only the orbital camera's orientation and field of view. Consequently, panning through the solar scene does not create spurious stellar parallax. The display mapping `(X,Y,Z) → (X,Z,−Y)` is consistently right-handed for planets, spacecraft, stars and the grid.

These rounded J2000 directions omit proper motion. The background is for inertial orientation, not precision astrometry. The orbital camera is external to Earth: the Earth page's geometric geocentric RA/Dec readouts are computed from its Cartesian state, not from the marker's apparent screen position.

## Reproducibility and sources

See [README](README.md) for cached rebuilds, explicit refreshes, and numerical/browser tests. [Transfer JSON](docs/data/transfer.json), [CSV](docs/data/mmx_transfer.csv), [summary](docs/data/transfer_summary.json), and [provenance](docs/data/transfer_provenance.json) retain the study's numerical record. The earlier Earth-centered study remains in [study.md](study.md).

Sources: [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/), [API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [JAXA MMX mission](https://www.mmx.jaxa.jp/en/mission/), and [d3-celestial](https://github.com/ofrohn/d3-celestial). See [third-party notices](THIRD_PARTY_NOTICES.md) for the catalog/software attributions. **Illustration: Mickey.**
