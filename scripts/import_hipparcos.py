"""Import the Roman chart's Hipparcos V < 6.6 CSV as inertial display data."""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "web/assets/hipparcos.json")
    args = parser.parse_args()
    raw = args.csv.read_bytes()
    stars, ids = [], []
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8"))):
        hip = int(row["HIP"])
        ra, dec, magnitude = (float(row[key]) for key in ("RAICRS", "DEICRS", "Vmag"))
        if not (all(math.isfinite(x) for x in (ra, dec, magnitude))
                and 0 <= ra < 360 and -90 <= dec <= 90 and -2 < magnitude < 6.6):
            raise ValueError(f"Invalid Hipparcos row: {hip}")
        ids.append(hip)
        stars.append([ra, dec, magnitude])
    if not stars or len(set(ids)) != len(ids):
        raise ValueError("Empty catalog or duplicate HIP identifiers")
    data = {
        "meta": {
            "source": "ESA 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200; CDS/VizieR I/239/hip_main",
            "source_url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239",
            "reference": "Roman sky-track chart, data/hip_bright.csv",
            "source_sha256": hashlib.sha256(raw).hexdigest(),
            "coordinates": "ICRS right ascension and declination in degrees; catalog epoch J1991.25",
            "columns": ["ra_deg", "dec_deg", "Vmag"],
            "magnitude_limit_exclusive": 6.6,
            "accuracy_note": "Catalog directions without proper-motion, parallax or aberration correction; orientation reference only.",
        },
        "hip_ids": ids,
        "stars": stars,
    }
    args.output.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"Imported {len(stars):,} Hipparcos stars to {args.output}")


if __name__ == "__main__":
    main()
