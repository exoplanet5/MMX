"""Offline numerical/provenance acceptance checks."""
import csv
import hashlib
import json
from pathlib import Path
import unittest

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
D = json.loads((ROOT / "docs/data/ephemeris.json").read_text())


class EphemerisTests(unittest.TestCase):
    def test_coverage_and_units(self):
        self.assertEqual(D["meta"]["target_id"], -239)
        self.assertEqual(D["meta"]["time_scale"], "UTC")
        self.assertEqual(D["meta"]["position_unit"], "km")
        self.assertEqual(D["meta"]["velocity_unit"], "km/s")
        np.testing.assert_array_equal(D["elapsed_s"], np.arange(8641) * 60)
        for body in ("mmx", "moon", "sun"):
            a = np.array(D["states"][body])
            self.assertEqual(a.shape, (8641, 6))
            self.assertTrue(np.isfinite(a).all())

    def test_derived_values(self):
        r = np.array(D["states"]["mmx"])
        moon = np.array(D["states"]["moon"])
        np.testing.assert_allclose(np.linalg.norm(r[:, :3], axis=1), D["metrics"]["earth_range_km"], rtol=1e-14)
        np.testing.assert_allclose(np.linalg.norm(r[:, 3:], axis=1), D["metrics"]["speed_km_s"], rtol=1e-14)
        np.testing.assert_allclose(np.linalg.norm(r[:, :3] - moon[:, :3], axis=1), D["metrics"]["moon_distance_km"], rtol=1e-14)
        self.assertTrue(np.all(np.diff(D["metrics"]["earth_range_km"]) > 0))
        self.assertTrue(np.all(np.diff(D["metrics"]["moon_distance_km"]) > 0))
        self.assertAlmostEqual(D["metrics"]["earth_range_km"][0], 8703.971435120235, places=6)
        self.assertAlmostEqual(D["metrics"]["earth_range_km"][-1], 1776012.2548105323, places=6)

    def test_validation_and_orientation(self):
        v = D["summary"]["validation"]
        self.assertEqual(v["midpoint_count"], 8640)
        self.assertLess(v["max_position_error_km"], .006)
        self.assertLess(v["max_velocity_error_km_s"], .0023)
        self.assertLess(v["max_moon_de440s_vs_horizons_km"], .003)
        q = np.array(D["earth_quaternion_xyzw"])
        np.testing.assert_allclose(np.linalg.norm(q, axis=1), 1, atol=1e-14)
        self.assertTrue(np.all(np.sum(q[:-1] * q[1:], axis=1) > 0))

    def test_raw_hashes(self):
        folder = ROOT / "data/raw" / D["meta"]["snapshot"]
        manifest = json.loads((folder / "manifest.json").read_text())
        for entry in manifest["requests"].values():
            actual = hashlib.sha256((folder / entry["file"]).read_bytes()).hexdigest()
            self.assertEqual(actual, entry["sha256"])
        self.assertEqual(manifest["requests"]["mmx"]["sha256"], D["meta"]["raw_response_sha256"])

    def test_csv_agreement(self):
        with (ROOT / "docs/data/mmx_eci.csv").open() as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 8641)
        self.assertEqual(rows[0]["utc"], D["meta"]["start_utc"])
        self.assertEqual(rows[-1]["utc"], D["meta"]["end_utc"])
        for i in (0, 60, 1440, 4320, 8640):
            self.assertEqual(float(rows[i]["x_km"]), D["states"]["mmx"][i][0])

    def test_figure_dimensions(self):
        files = sorted((ROOT / "docs/plots").glob("*.png"))
        self.assertEqual(len(files), 4)
        for path in files:
            with Image.open(path) as im:
                self.assertEqual(im.size, (2880, 1782))


if __name__ == "__main__":
    unittest.main(verbosity=2)
