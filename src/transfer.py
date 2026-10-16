"""Build a heliocentric MMX transfer dataset, ending before the arrival model splice."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import argparse
import csv
import json
import runpy
import tempfile
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np
from scipy.interpolate import CubicHermiteSpline
from scipy.optimize import brentq
from skyfield.api import load, load_file

ROOT = Path(__file__).resolve().parents[1]
HELPERS = runpy.run_path(str(ROOT / "src/ephemeris.py"))
iso, digest, write_json = (HELPERS[k] for k in ("iso", "digest", "write_json"))
params_for, parse = (HELPERS[k] for k in ("request_params", "parse_response"))
API = HELPERS["API"]
UTC = timezone.utc
START = datetime(2026, 10, 19, 21, tzinfo=UTC)
END = datetime(2027, 8, 29, 4, 57, tzinfo=UTC)
AU = 149597870.7
SEGMENTS = [
    ("departure", START, datetime(2026, 10, 20, 3, tzinfo=UTC), 60),
    ("cruise", datetime(2026, 10, 20, 3, tzinfo=UTC), datetime(2027, 8, 27, tzinfo=UTC), 3600),
    ("approach", datetime(2027, 8, 27, tzinfo=UTC), datetime(2027, 8, 29, 4, tzinfo=UTC), 300),
    ("terminal", datetime(2027, 8, 29, 4, tzinfo=UTC), END, 60),
]
BODIES = {"earth": "earth", "mars": "mars barycenter", "jupiter": "jupiter barycenter", "saturn": "saturn barycenter"}
PERIODS = {"earth": 365.256, "mars": 686.980, "jupiter": 4332.59, "saturn": 10759.22}


def refresh():
    base = ROOT / "data/transfer_raw"
    base.mkdir(parents=True, exist_ok=True)
    folder = Path(tempfile.mkdtemp(prefix=datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ_"), dir=base))
    manifest = {"retrieved_utc": iso(datetime.now(UTC)), "api": API, "requests": {}}
    requests = []
    for name, start, end, step in SEGMENTS:
        requests.append((name, start, end, step))
        requests.append((name + "_checks", start + timedelta(seconds=step / 2), end - timedelta(seconds=step / 2), step))
    requests.append(("arrival_boundary", datetime(2027, 8, 29, 4, 55, tzinfo=UTC), datetime(2027, 8, 29, 5, tzinfo=UTC), 60))
    for name, start, end, step in requests:
        params = params_for(-239, start, end, f"{step // 60} m", center=10)
        url = API + "?" + urlencode(params)
        print(f"Fetching {name}: {iso(start)} to {iso(end)}", flush=True)
        with urlopen(url, timeout=180) as response:
            body = response.read()
        dest = folder / f"{name}.json"; dest.write_bytes(body)
        parse(dest, -239, start, end, step, center=10)
        manifest["requests"][name] = {"file": dest.name, "parameters": params, "url": url,
            "sha256": digest(dest), "start_utc": iso(start), "end_utc": iso(end), "step_s": step}
    write_json(folder / "manifest.json", manifest, pretty=True)
    return folder


def planet_states(kernel, ts, epochs):
    t = ts.from_datetimes(epochs)
    return {name: np.column_stack(((kernel[key] - kernel["sun"]).at(t).position.km.T,
                                  (kernel[key] - kernel["sun"]).at(t).velocity.km_per_s.T))
            for name, key in BODIES.items()}


def build(folder, kernel_path):
    manifest = json.loads((folder / "manifest.json").read_text())
    for entry in manifest["requests"].values():
        if digest(folder / entry["file"]) != entry["sha256"]:
            raise ValueError("Cached Horizons response changed")
    epochs, states, check_epochs, check_states = [], [], [], []
    for name, start, end, step in SEGMENTS:
        times, values, header = parse(folder / f"{name}.json", -239, start, end, step, center=10)
        if epochs:
            np.testing.assert_allclose(values[0], states[-1], atol=1e-7, rtol=0)
            times, values = times[1:], values[1:]
        epochs.extend(times); states.extend(values)
        times, values, _ = parse(folder / f"{name}_checks.json", -239,
            start + timedelta(seconds=step / 2), end - timedelta(seconds=step / 2), step, center=10)
        check_epochs.extend(times); check_states.extend(values)
    states = np.asarray(states); checks = np.asarray(check_states)
    elapsed = np.array([(t - START).total_seconds() for t in epochs])
    check_t = np.array([(t - START).total_seconds() for t in check_epochs])
    assert elapsed[0] == 0 and epochs[-1] == END and np.all(np.diff(elapsed) > 0)
    spline = CubicHermiteSpline(elapsed, states[:, :3], states[:, 3:])
    position_error = np.linalg.norm(spline(check_t) - checks[:, :3], axis=1)
    velocity_error = np.linalg.norm(spline(check_t, 1) - checks[:, 3:], axis=1)
    if position_error.max() > 25 or velocity_error.max() > .05:
        raise ValueError(f"Sampling needs refinement: {position_error.max()} km, {velocity_error.max()} km/s")
    ts = load.timescale(builtin=True); kernel = load_file(str(kernel_path))
    bodies = planet_states(kernel, ts, epochs)
    sun_range = np.linalg.norm(states[:, :3], axis=1)
    earth_range = np.linalg.norm(states[:, :3] - bodies["earth"][:, :3], axis=1)
    mars_range = np.linalg.norm(states[:, :3] - bodies["mars"][:, :3], axis=1)
    speed = np.linalg.norm(states[:, 3:], axis=1)
    mars_spline = CubicHermiteSpline(elapsed, bodies["mars"][:, :3], bodies["mars"][:, 3:])
    maximum = int(np.argmax(sun_range))
    aphelion_t = brentq(lambda t: float(spline(t) @ spline(t, 1)), elapsed[maximum - 1], elapsed[maximum + 1])
    events = [dict(utc=iso(START), seconds=0, title="Earth departure", detail="First displayed planning state; the six-day Earth view starts here.", kind="window")]
    events.append(dict(utc=iso(START + timedelta(seconds=aphelion_t)), seconds=float(aphelion_t), title="Cruise aphelion",
        detail=f"Heliocentric maximum {np.linalg.norm(spline(aphelion_t))/AU:.4f} AU, derived from this planning arc.", kind="geometry"))
    for distance in (1e6, 1e5):
        indices = np.where((mars_range[:-1] > distance) & (mars_range[1:] <= distance))[0]
        if len(indices) != 1:
            raise ValueError(f"Unexpected inbound Mars threshold crossings: {distance}")
        i = indices[0]
        crossing = brentq(lambda t: np.linalg.norm(spline(t) - mars_spline(t)) - distance, elapsed[i], elapsed[i + 1])
        events.append(dict(utc=iso(START + timedelta(seconds=crossing)), seconds=float(crossing),
            title=f"{distance:,.0f} km from Mars", detail="Inbound distance threshold, not an officially timed mission phase.", kind="geometry"))
    events.append(dict(utc=iso(END), seconds=float(elapsed[-1]), title="Mars arrival boundary",
        detail="Transfer display ends before the 04:57–04:58 UTC planning-arc discontinuity. Not a resolved insertion burn.", kind="boundary"))
    boundary_times, boundary, _ = parse(folder / "arrival_boundary.json", -239,
        datetime(2027, 8, 29, 4, 55, tzinfo=UTC), datetime(2027, 8, 29, 5, tzinfo=UTC), 60, center=10)
    deltas = np.linalg.norm(np.diff(boundary[:, :3], axis=0) - 30 * (boundary[:-1, 3:] + boundary[1:, 3:]), axis=1)
    jump_i = int(np.argmax(deltas))
    if deltas[jump_i] < 1000 or boundary_times[jump_i] != END:
        raise ValueError("Arrival planning splice changed; re-evaluate the transfer window")
    boundary_mars = planet_states(kernel, ts, boundary_times)["mars"]
    boundary_report = {"before_utc": iso(boundary_times[jump_i]), "after_utc": iso(boundary_times[jump_i + 1]),
        "position_jump_km": float(np.linalg.norm(boundary[jump_i + 1, :3] - boundary[jump_i, :3])),
        "velocity_integration_discrepancy_km": float(deltas[jump_i]),
        "mars_range_before_km": float(np.linalg.norm(boundary[jump_i, :3] - boundary_mars[jump_i, :3])),
        "mars_range_after_km": float(np.linalg.norm(boundary[jump_i + 1, :3] - boundary_mars[jump_i + 1, :3])),
        "interpretation": "Discontinuous planning-arc splice, not a resolved physical maneuver. No interpolation/rendered segment crosses it."}
    orbits = {}
    for name, period in PERIODS.items():
        times = ts.from_datetimes([START + timedelta(days=float(d)) for d in np.linspace(0, period, 721)])
        positions = (kernel[BODIES[name]] - kernel["sun"]).at(times).position.km.T
        orbits[name] = {"position_km": positions.tolist(), "start_utc": iso(START),
            "end_utc": iso(START + timedelta(days=period)), "nominal_period_days": period,
            "description": "Geometric DE440s heliocentric reference track over one nominal orbital period from the start epoch; not the transfer time span."}
    validation = {"midpoint_count": len(check_t), "max_position_error_km": float(position_error.max()),
        "max_position_error_utc": iso(check_epochs[int(position_error.argmax())]),
        "max_velocity_error_km_s": float(velocity_error.max()),
        "max_velocity_error_utc": iso(check_epochs[int(velocity_error.argmax())])}
    meta = {"title": "MMX Mars Transfer", "view_kind": "transfer", "target_id": -239, "center_id": 10,
        "center": "Sun center (10)", "frame": "Heliocentric ICRF equatorial inertial axes",
        "state_type": "geometric; no light-time or aberration corrections", "time_scale": "UTC",
        "start_utc": iso(START), "end_utc": iso(END), "duration_s": int(elapsed[-1]), "samples": len(epochs),
        "step_s": None, "sampling": [{"start_utc": iso(a), "end_utc": iso(b), "step_s": s} for _, a, b, s in SEGMENTS],
        "position_unit": "km", "velocity_unit": "km/s", "au_km": AU, "earth_radius_km": 6378.137,
        "status": "JAXA pre-launch planning trajectory; not flight reconstruction",
        "trajectory_source": "JAXA 20261019_20281231_MMX_V0.2 via JPL Horizons",
        "source_headers": [line.strip() for line in header.splitlines() if "{source:" in line or "Revised:" in line],
        "retrieved_utc": manifest["retrieved_utc"], "snapshot": folder.name,
        "available_ephemeris": "2026-10-19 20:57:30 UTC through 2028-12-31 (end date reported by Horizons)",
        "arrival_context": "Horizons target description says August 2027; precise boundary is inferred from the planning ephemeris, not an official insertion schedule.",
        "context_kernel": "JPL DE440s", "context_kernel_sha256": digest(kernel_path),
        "planet_centers": {"earth": "Earth center (399)", "mars": "Mars system barycenter (4)", "jupiter": "Jupiter system barycenter (5)", "saturn": "Saturn system barycenter (6)"},
        "accuracy_note": "Interpolation residuals quantify agreement with a planning ephemeris, not future-flight uncertainty. No covariance supplied.",
        "software": {name: HELPERS["version"](name) for name in ("numpy", "scipy", "skyfield", "jplephem")}}
    summary = {"validation": validation, "arrival_boundary": boundary_report, "timeline": events,
        "start": {"utc": iso(START), "heliocentric_range_km": float(sun_range[0]), "speed_km_s": float(speed[0]), "earth_range_km": float(earth_range[0])},
        "end": {"utc": iso(END), "heliocentric_range_km": float(sun_range[-1]), "speed_km_s": float(speed[-1]), "earth_range_km": float(earth_range[-1]), "mars_range_km": float(mars_range[-1])}}
    dataset = {"meta": meta, "elapsed_s": elapsed.tolist(), "states": {"mmx": states.tolist(), **{k: a.tolist() for k, a in bodies.items()}},
        "metrics": {"heliocentric_range_km": sun_range.tolist(), "speed_km_s": speed.tolist(), "earth_range_km": earth_range.tolist(), "mars_range_km": mars_range.tolist()},
        "orbits": orbits, "summary": summary}
    out = ROOT / "docs/data"
    write_json(out / "transfer.json", dataset)
    write_json(out / "transfer_summary.json", summary, pretty=True)
    write_json(out / "transfer_provenance.json", {"meta": meta, "raw_manifest": manifest}, pretty=True)
    with (out / "mmx_transfer.csv").open("w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["utc", "elapsed_s", "x_km", "y_km", "z_km", "vx_km_s", "vy_km_s", "vz_km_s", "heliocentric_range_km", "speed_km_s", "earth_range_km", "mars_range_km"])
        for i, epoch in enumerate(epochs):
            writer.writerow([iso(epoch), elapsed[i], *states[i], sun_range[i], speed[i], earth_range[i], mars_range[i]])
    fixture_i = np.unique(np.r_[0, 1, np.linspace(0, len(check_t) - 1, 36, dtype=int), position_error.argmax(), velocity_error.argmax()])
    fixture_bodies = planet_states(kernel, ts, [check_epochs[i] for i in fixture_i])
    fixtures = [{"seconds": float(check_t[i]), "horizons_mmx": checks[i].tolist(),
        "interpolated_mmx": np.r_[spline(check_t[i]), spline(check_t[i], 1)].tolist(),
        "earth": fixture_bodies["earth"][j].tolist(), "mars": fixture_bodies["mars"][j].tolist()} for j, i in enumerate(fixture_i)]
    write_json(ROOT / "tests/transfer_fixtures.json", fixtures, pretty=True)
    print(json.dumps(summary, indent=2)); print(f"Wrote {len(epochs)} transfer states; {len(check_t)} independent checks.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--snapshot", type=Path)
    parser.add_argument("--kernel", type=Path, default=Path.home() / "JPLDE/de440s.bsp")
    args = parser.parse_args()
    if args.refresh and args.snapshot:
        parser.error("Choose --refresh or --snapshot")
    if args.refresh:
        folder = refresh()
    elif args.snapshot:
        folder = args.snapshot.resolve()
    else:
        available = sorted((ROOT / "data/transfer_raw").glob("*/manifest.json"))
        if not available:
            parser.error("No transfer snapshot; use --refresh")
        folder = available[-1].parent
    build(folder, args.kernel.expanduser().resolve())


if __name__ == "__main__":
    main()
