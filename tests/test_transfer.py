"""Offline acceptance checks for the heliocentric transfer and stellar reference."""
import hashlib
import json
from pathlib import Path
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
D = json.loads((ROOT / "docs/data/transfer.json").read_text())


class TransferTests(unittest.TestCase):
    def test_frame_and_sampling(self):
        self.assertEqual(D["meta"]["center_id"], 10)
        self.assertEqual(D["meta"]["time_scale"], "UTC")
        self.assertEqual(D["meta"]["samples"], 8503)
        self.assertEqual(D["meta"]["end_utc"], "2027-08-29T04:57:00Z")
        elapsed = np.array(D["elapsed_s"])
        self.assertTrue(np.all(np.diff(elapsed) > 0))
        self.assertEqual(set(np.diff(elapsed)), {60, 300, 3600})
        self.assertEqual(elapsed[-1], 27071820)
        for name in ("mmx", "earth", "mars", "jupiter", "saturn"):
            a = np.array(D["states"][name])
            self.assertEqual(a.shape, (8503, 6))
            self.assertTrue(np.isfinite(a).all())

    def test_heliocentric_and_geocentric_metrics(self):
        mmx, earth = np.array(D["states"]["mmx"]), np.array(D["states"]["earth"])
        np.testing.assert_allclose(np.linalg.norm(mmx[:, :3], axis=1), D["metrics"]["heliocentric_range_km"], rtol=1e-14)
        np.testing.assert_allclose(np.linalg.norm(mmx[:, 3:], axis=1), D["metrics"]["speed_km_s"], rtol=1e-14)
        np.testing.assert_allclose(np.linalg.norm(mmx[:, :3] - earth[:, :3], axis=1), D["metrics"]["earth_range_km"], rtol=1e-14)
        self.assertAlmostEqual(D["metrics"]["earth_range_km"][0], 8703.971435, places=4)
        self.assertAlmostEqual(D["metrics"]["heliocentric_range_km"][-1], 228863919.845514, places=5)
        self.assertTrue(3890 < D["metrics"]["mars_range_km"][-1] < 3895)

    def test_arrival_splice_is_outside_viewer(self):
        boundary = D["summary"]["arrival_boundary"]
        self.assertEqual(boundary["before_utc"], D["meta"]["end_utc"])
        self.assertEqual(boundary["after_utc"], "2027-08-29T04:58:00Z")
        self.assertGreater(boundary["velocity_integration_discrepancy_km"], 8000)
        self.assertGreater(boundary["mars_range_after_km"], 9200)
        self.assertEqual(D["summary"]["timeline"][-1]["seconds"], D["meta"]["duration_s"])
        self.assertTrue(D["summary"]["timeline"][1]["utc"].startswith("2027-07-21"))
        v = D["summary"]["validation"]
        self.assertEqual(v["midpoint_count"], 8502)
        self.assertLess(v["max_position_error_km"], 1.477)
        self.assertLess(v["max_velocity_error_km_s"], .006)

    def test_raw_provenance(self):
        folder = ROOT / "data/transfer_raw" / D["meta"]["snapshot"]
        manifest = json.loads((folder / "manifest.json").read_text())
        self.assertEqual(len(manifest["requests"]), 9)
        for entry in manifest["requests"].values():
            self.assertEqual(entry["parameters"]["CENTER"], "'500@10'")
            self.assertEqual(entry["parameters"]["REF_PLANE"], "'FRAME'")
            self.assertEqual(hashlib.sha256((folder / entry["file"]).read_bytes()).hexdigest(), entry["sha256"])

    def test_planet_reference_orbits(self):
        for name, orbit in D["orbits"].items():
            p = np.array(orbit["position_km"])
            self.assertEqual(p.shape, (721, 3))
            self.assertTrue(np.isfinite(p).all())
            self.assertLess(np.linalg.norm(p[-1] - p[0]) / np.linalg.norm(p[0]), .03)
        self.assertGreater(D["orbits"]["saturn"]["nominal_period_days"], 10000)

    def test_stellar_catalog(self):
        sky = json.loads((ROOT / "web/assets/stars.json").read_text())
        self.assertEqual(len(sky["stars"]), 1018)
        self.assertEqual(len(sky["names"]), 110)
        self.assertEqual(len(sky["lines"]), 150)
        stars = np.array(sky["stars"])
        self.assertTrue(np.all(np.abs(stars[:, 0]) <= 180))
        self.assertTrue(np.all(np.abs(stars[:, 1]) <= 90))
        self.assertTrue(np.all(stars[:, 2] <= 4.6))
        names = {row[2]: row[:2] for row in sky["names"]}
        self.assertEqual(names["Sirius"], [101.29, -16.72])
        self.assertEqual(names["Polaris"], [37.95, 89.26])
        self.assertEqual(sky["meta"]["license"], "BSD-3-Clause")


if __name__ == "__main__":
    unittest.main(verbosity=2)
