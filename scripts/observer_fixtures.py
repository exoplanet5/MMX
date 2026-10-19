"""Independent topocentric reference values for the browser sky-chart geometry.

Skyfield supplies each site's GCRS position and its ITRS rotation; local east/north/up axes are formed in ITRS from
geodetic coordinates. The browser instead rotates WGS84 sites with the baked scene quaternions, so agreement checks
the quaternion path, the display-axis inversion and the horizontal-coordinate conventions together.
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from skyfield.api import Loader, wgs84
from skyfield.framelib import itrs

ROOT = Path(__file__).resolve().parents[1]
SITES = [("Misasa DSS", 36.1333, 138.35, 1580.0), ("Singapore", 1.3521, 103.8198, 0.0),
         ("New Delhi", 28.6139, 77.209, 0.0), ("Yakutsk", 62.0355, 129.6755, 0.0)]
NATIVE = [0, 1, 2, 30, 61, 180, 720, 1440, 4320, 8640]
OFFSETS = [45.0, 3617.25, 200000.5, 431999.0]


def enu(lat, lon):
    p, l = np.radians(lat), np.radians(lon)
    return (np.array([-np.sin(l), np.cos(l), 0.0]), np.array([-np.sin(p) * np.cos(l), -np.sin(p) * np.sin(l), np.cos(p)]),
            np.array([np.cos(p) * np.cos(l), np.cos(p) * np.sin(l), np.sin(p)]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=ROOT / "docs/data/ephemeris.json")
    parser.add_argument("--output", type=Path, default=ROOT / "tests/observer_fixtures.json")
    args = parser.parse_args()
    data = json.loads(args.data.read_text())
    start = datetime.fromisoformat(data["meta"]["start_utc"].replace("Z", "+00:00"))
    ts = Loader(str(Path.home() / "JPLDE")).timescale(builtin=True)
    mmx, sun = np.array(data["states"]["mmx"]), np.array(data["states"]["sun"])
    records = []
    for name, lat, lon, height in SITES:
        site = wgs84.latlon(lat, lon, elevation_m=height)
        east, north, up = enu(lat, lon)
        for seconds in [data["elapsed_s"][i] for i in NATIVE] + OFFSETS:
            t = ts.from_datetime(start + timedelta(seconds=seconds))
            position = site.at(t).position.km
            to_icrf = itrs.rotation_at(t).T
            record = {"site": name, "lat": lat, "lon": lon, "height_km": height / 1000, "seconds": seconds,
                      "position_km": position.tolist(),
                      "east": (to_icrf @ east).tolist(), "north": (to_icrf @ north).tolist(), "up": (to_icrf @ up).tolist()}
            if float(seconds).is_integer() and int(seconds) % 60 == 0:
                i = int(seconds) // 60
                for body, states in (("mmx", mmx), ("sun", sun)):
                    rho = itrs.rotation_at(t) @ (states[i, :3] - position)
                    distance = np.linalg.norm(rho)
                    e, n, u = rho @ east, rho @ north, rho @ up
                    icrf = states[i, :3] - position
                    record[body] = {"range_km": float(distance), "az_deg": float(np.degrees(np.arctan2(e, n)) % 360),
                                    "el_deg": float(np.degrees(np.arcsin(u / distance))),
                                    "ra_deg": float(np.degrees(np.arctan2(icrf[1], icrf[0])) % 360),
                                    "dec_deg": float(np.degrees(np.arcsin(icrf[2] / distance)))}
                # Skyfield's own horizon rotation is an independent check of the azimuth convention.
                local = site.rotation_at(t) @ (mmx[i, :3] - position)
                record["mmx"]["skyfield_az_deg"] = float(np.degrees(np.arctan2(local[1], local[0])) % 360)
                record["mmx"]["skyfield_el_deg"] = float(np.degrees(np.arcsin(local[2] / np.linalg.norm(local))))
            records.append(record)
    meta = {"source": "Skyfield wgs84 GCRS site positions and ITRS rotation; built-in timescale; polar motion omitted",
            "dataset": data["meta"]["snapshot"], "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    args.output.write_text(json.dumps({"meta": meta, "records": records}, indent=1) + "\n")
    print(f"Wrote {len(records)} topocentric fixtures to {args.output}")


if __name__ == "__main__":
    main()
