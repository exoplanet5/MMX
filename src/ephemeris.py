"""Capture Horizons planning states and build the shared MMX study dataset."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta, timezone
import hashlib
from importlib.metadata import version
import io
import json
from pathlib import Path
import tempfile
from urllib.parse import urlencode
from urllib.request import urlopen

import numpy as np
from scipy.interpolate import CubicHermiteSpline
from scipy.spatial.transform import Rotation
from skyfield.api import load, load_file
from skyfield.framelib import itrs

ROOT = Path(__file__).resolve().parents[1]
START = datetime(2026, 10, 19, 21, tzinfo=timezone.utc)
STOP = datetime(2026, 10, 25, 21, tzinfo=timezone.utc)
DURATION = 518400
RE = 6378.137
MU = 398600.435507
MAPPING = np.array([[1., 0., 0.], [0., 0., 1.], [0., -1., 0.]])
API = "https://ssd.jpl.nasa.gov/api/horizons.api"


def iso(t):
    return t.isoformat(timespec="seconds").replace("+00:00", "Z")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value, pretty=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2 if pretty else None,
                               separators=None if pretty else (",", ":"), allow_nan=False) + "\n")


def request_params(target, start, stop, step):
    values = dict(COMMAND=str(target), EPHEM_TYPE="VECTORS", CENTER="500@399",
                  START_TIME=start.strftime("%Y-%m-%d %H:%M:%S"),
                  STOP_TIME=stop.strftime("%Y-%m-%d %H:%M:%S"), STEP_SIZE=step,
                  REF_SYSTEM="ICRF", REF_PLANE="FRAME", TIME_TYPE="UT", VEC_CORR="NONE",
                  OUT_UNITS="KM-S", VEC_TABLE="2", CSV_FORMAT="YES", CAL_FORMAT="CAL")
    return {"format": "json", **{k: f"'{v}'" for k, v in values.items()}}


def parse_response(path, target, start, stop, step_seconds):
    response = json.loads(path.read_text())
    if response.get("error"):
        raise ValueError(response["error"])
    result = response.get("result", "")
    header = result.split("$$SOE")[0]
    required = [f"({target})", "Center body name: Earth (399)", "Reference frame : ICRF",
                "Output units    : KM-S", "GEOMETRIC cartesian states", "Calendar Date (UT"]
    if not all(token in header for token in required):
        raise ValueError(f"Unexpected target/frame/time/unit metadata in {path}")
    if result.count("$$SOE") != 1 or result.count("$$EOE") != 1:
        raise ValueError(f"Missing or ambiguous state table in {path}")
    rows = csv.reader(io.StringIO(result.split("$$SOE")[1].split("$$EOE")[0].strip()))
    epochs, states = [], []
    for row in rows:
        t = datetime.strptime(row[1].strip(), "A.D. %Y-%b-%d %H:%M:%S.%f").replace(tzinfo=timezone.utc)
        jd = float(row[0])
        if abs((jd - 2440587.5) * 86400 - t.timestamp()) > 0.002:
            raise ValueError("Calendar UTC and Julian UT disagree")
        epochs.append(t)
        states.append([float(x) for x in row[2:8]])
    expected = int((stop - start).total_seconds() / step_seconds) + 1
    if len(states) != expected or epochs[0] != start or epochs[-1] != stop:
        raise ValueError(f"Incorrect coverage/count in {path}")
    dt = np.array([(t - start).total_seconds() for t in epochs])
    if not np.array_equal(dt, np.arange(expected) * step_seconds):
        raise ValueError("Duplicate, unordered or missing epochs")
    states = np.asarray(states)
    if states.shape != (expected, 6) or not np.isfinite(states).all():
        raise ValueError("Invalid Cartesian states")
    return epochs, states, header


def fetch_snapshot():
    raw = ROOT / "data/raw"
    raw.mkdir(parents=True, exist_ok=True)
    folder = Path(tempfile.mkdtemp(prefix=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ_"), dir=raw))
    manifest = {"retrieved_utc": iso(datetime.now(timezone.utc)), "api": API, "requests": {}}
    queries = [
        ("mmx", -239, START, STOP, "1 m", 60),
        ("midpoints", -239, START + timedelta(seconds=30), STOP - timedelta(seconds=30), "1 m", 60),
        ("moon_check", 301, START, STOP, "1 d", 86400),
    ]
    for name, target, start, stop, step, seconds in queries:
        params = request_params(target, start, stop, step)
        url = API + "?" + urlencode(params)
        print(f"Fetching {name}: {start} to {stop}", flush=True)
        with urlopen(url, timeout=180) as response:
            body = response.read()
        dest = folder / f"{name}.json"
        dest.write_bytes(body)
        parse_response(dest, target, start, stop, seconds)
        manifest["requests"][name] = {"parameters": params, "url": url, "file": dest.name,
                                       "sha256": digest(dest), "retrieved_utc": iso(datetime.now(timezone.utc))}
    write_json(folder / "manifest.json", manifest, pretty=True)
    print(f"Validated snapshot: {folder}", flush=True)
    return folder


def context(epochs, kernel, timescale):
    t = timescale.from_datetimes(epochs)
    bodies = {}
    for name in ("moon", "sun"):
        state = (kernel[name] - kernel["earth"]).at(t)
        bodies[name] = np.column_stack((state.position.km.T, state.velocity.km_per_s.T))
    # Skyfield returns ICRF-to-ITRS. The globe's local axes use the same Y-up map as the scene.
    fixed_to_icrf = np.moveaxis(itrs.rotation_at(t), 2, 0).transpose(0, 2, 1)
    scene_rotations = MAPPING @ fixed_to_icrf @ MAPPING.T
    q = Rotation.from_matrix(scene_rotations).as_quat()
    for i in range(1, len(q)):
        if np.dot(q[i - 1], q[i]) < 0:
            q[i] *= -1
    return bodies, q, t


def diagnostics(state):
    r, v = state[:3], state[3:]
    rn, vn = np.linalg.norm(r), np.linalg.norm(v)
    h = np.cross(r, v)
    return dict(earth_range_km=float(rn), speed_km_s=float(vn),
                spherical_altitude_km=float(rn - RE), earth_only_c3_km2_s2=float(vn**2 - 2 * MU / rn),
                osculating_eccentricity=float(np.linalg.norm(np.cross(v, h) / MU - r / rn)),
                osculating_inclination_deg=float(np.degrees(np.arccos(np.clip(h[2] / np.linalg.norm(h), -1, 1)))))


def build(snapshot, kernel_path):
    manifest = json.loads((snapshot / "manifest.json").read_text())
    for entry in manifest["requests"].values():
        if digest(snapshot / entry["file"]) != entry["sha256"]:
            raise ValueError("Raw response hash does not match its manifest")
    epochs, states, header = parse_response(snapshot / "mmx.json", -239, START, STOP, 60)
    mid_epochs, mid_states, _ = parse_response(snapshot / "midpoints.json", -239, START + timedelta(seconds=30), STOP - timedelta(seconds=30), 60)
    _, moon_check, _ = parse_response(snapshot / "moon_check.json", 301, START, STOP, 86400)
    ts = load.timescale(builtin=True)
    kernel = load_file(str(kernel_path))
    bodies, quaternions, t = context(epochs, kernel, ts)
    elapsed = np.arange(len(states)) * 60
    midpoint_seconds = elapsed[:-1] + 30
    spline = CubicHermiteSpline(elapsed, states[:, :3], states[:, 3:])
    pos_error = np.linalg.norm(spline(midpoint_seconds) - mid_states[:, :3], axis=1)
    vel_error = np.linalg.norm(spline(midpoint_seconds, 1) - mid_states[:, 3:], axis=1)
    moon_error = np.linalg.norm(bodies["moon"][::1440, :3] - moon_check[:, :3], axis=1)
    if pos_error.max() >= 1:
        raise ValueError(f"Interpolation error {pos_error.max()} km exceeds 1 km")
    if moon_error.max() >= 1:
        raise ValueError(f"DE440s/Horizons lunar cross-check differs by {moon_error.max()} km")
    ranges = np.linalg.norm(states[:, :3], axis=1)
    speeds = np.linalg.norm(states[:, 3:], axis=1)
    lunar_distance = np.linalg.norm(states[:, :3] - bodies["moon"][:, :3], axis=1)
    imin = int(np.argmin(lunar_distance))
    source_lines = [line.strip() for line in header.splitlines() if "{source:" in line or "Revised:" in line]
    meta = {
        "title": "MMX Earth Departure", "target_id": -239, "center": "Earth center (399)",
        "frame": "Earth-centered ICRF, equatorial inertial axes (J2000-aligned)",
        "state_type": "geometric; no light-time or aberration corrections", "time_scale": "UTC",
        "start_utc": iso(START), "end_utc": iso(STOP), "duration_s": DURATION, "step_s": 60, "samples": len(states),
        "position_unit": "km", "velocity_unit": "km/s", "earth_radius_km": RE, "moon_radius_km": 1737.4,
        "earth_mu_km3_s2": MU, "status": "Pre-launch planning trajectory; not flight reconstruction",
        "trajectory_source": "JAXA 20261019_20281231_MMX_V0.2 via JPL Horizons",
        "source_headers": source_lines, "retrieved_utc": manifest["retrieved_utc"], "snapshot": snapshot.name,
        "horizons_parameters": manifest["requests"]["mmx"]["parameters"],
        "raw_response_sha256": manifest["requests"]["mmx"]["sha256"],
        "context_kernel": "JPL DE440s (geometric Moon/Sun relative to Earth)", "context_kernel_sha256": digest(kernel_path),
        "scene_mapping": "(X,Y,Z) -> (X,Z,-Y) / earth_radius_km; right handed",
        "earth_orientation": "Skyfield ITRS rotation transposed; precession/nutation and UT1 from built-in timescale; polar motion omitted; quaternion xyzw in scene coordinates",
        "timescale_source": "Skyfield bundled leap seconds and delta-T; no IERS/network update",
        "software": {name: version(name) for name in ("numpy", "scipy", "skyfield", "jplephem")},
        "accuracy_note": "Interpolation validation is relative to this planning ephemeris, not a bound on future flight prediction error. No covariance supplied.",
    }
    validation = {
        "midpoint_count": len(mid_epochs), "max_position_error_km": float(pos_error.max()),
        "max_position_error_utc": iso(mid_epochs[int(pos_error.argmax())]),
        "max_velocity_error_km_s": float(vel_error.max()),
        "max_velocity_error_utc": iso(mid_epochs[int(vel_error.argmax())]),
        "moon_crosscheck_count": len(moon_error), "max_moon_de440s_vs_horizons_km": float(moon_error.max()),
        "earth_range_strictly_increasing": bool(np.all(np.diff(ranges) > 0)),
        "moon_distance_strictly_increasing": bool(np.all(np.diff(lunar_distance) > 0)),
        "earth_quaternion_max_norm_error": float(np.abs(np.linalg.norm(quaternions, axis=1) - 1).max()),
    }
    summary = {
        "start": {"utc": iso(START), "state_km_km_s": states[0].tolist(), **diagnostics(states[0])},
        "end": {"utc": iso(STOP), "state_km_km_s": states[-1].tolist(), **diagnostics(states[-1])},
        "minimum_sampled_moon_distance": {"utc": iso(epochs[imin]), "distance_km": float(lunar_distance[imin]),
                                           "at_window_boundary": imin in (0, len(states) - 1)},
        "final_moon_distance_km": float(lunar_distance[-1]), "validation": validation,
    }
    dataset = {"meta": meta, "elapsed_s": elapsed.tolist(), "states": {"mmx": states.tolist(), **{k: v.tolist() for k, v in bodies.items()}},
               "earth_quaternion_xyzw": quaternions.tolist(),
               "metrics": {"earth_range_km": ranges.tolist(), "speed_km_s": speeds.tolist(), "moon_distance_km": lunar_distance.tolist()},
               "summary": summary}
    dest = ROOT / "docs/data"
    write_json(dest / "ephemeris.json", dataset)
    write_json(dest / "summary.json", summary, pretty=True)
    write_json(dest / "provenance.json", {"meta": meta, "raw_manifest": manifest}, pretty=True)
    with (dest / "mmx_eci.csv").open("w", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["utc", "elapsed_s", "x_km", "y_km", "z_km", "vx_km_s", "vy_km_s", "vz_km_s", "earth_range_km", "speed_km_s", "moon_distance_km"])
        for i, epoch in enumerate(epochs):
            writer.writerow([iso(epoch), elapsed[i], *states[i], ranges[i], speeds[i], lunar_distance[i]])
    indices = np.unique(np.r_[0, 1, 2, 10, 30, 100, np.linspace(0, len(mid_states) - 1, 25, dtype=int)])
    fixture_context, _, _ = context([mid_epochs[i] for i in indices], kernel, ts)
    fixtures = [{"seconds": int(midpoint_seconds[i]), "horizons_mmx": mid_states[i].tolist(),
                 "interpolated_mmx": np.r_[spline(midpoint_seconds[i]), spline(midpoint_seconds[i], 1)].tolist(),
                 "moon_state": fixture_context["moon"][j].tolist()} for j, i in enumerate(indices)]
    # These surface directions exercise UV longitude handedness and Earth rotation independently of the viewer.
    orientation_fixtures = []
    for i in (0, 4320, 8640):
        rot = itrs.rotation_at(t[i]).T
        for name, ecef in [("Greenwich", [1, 0, 0]), ("90E", [0, 1, 0]), ("north", [0, 0, 1])]:
            orientation_fixtures.append({"index": i, "name": name, "local_scene": (MAPPING @ ecef).tolist(),
                                         "inertial_scene": (MAPPING @ rot @ ecef).tolist()})
    write_json(ROOT / "tests/fixtures.json", {"samples": fixtures, "orientation": orientation_fixtures}, pretty=True)
    print(json.dumps(summary, indent=2))
    print(f"Wrote canonical dataset: {dest / 'ephemeris.json'}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Retrieve a new immutable Horizons snapshot")
    parser.add_argument("--snapshot", type=Path, help="Rebuild from this cached snapshot, with no network requests")
    parser.add_argument("--kernel", type=Path, default=Path.home() / "JPLDE/de440s.bsp")
    args = parser.parse_args()
    if args.refresh and args.snapshot:
        parser.error("Choose --refresh or --snapshot")
    if args.refresh:
        snapshot = fetch_snapshot()
    elif args.snapshot:
        snapshot = args.snapshot.resolve()
    else:
        available = sorted((ROOT / "data/raw").glob("*/manifest.json"))
        if not available:
            parser.error("No cached snapshot; use --refresh")
        snapshot = available[-1].parent
    build(snapshot, args.kernel.expanduser().resolve())


if __name__ == "__main__":
    main()
