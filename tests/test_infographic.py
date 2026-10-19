"""Reproducible acceptance checks for the original mission-profile deliverables."""
import hashlib
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/infographics'
NS = {'s': 'http://www.w3.org/2000/svg'}


class InfographicTests(unittest.TestCase):
    def test_planning_data_provenance(self):
        m = json.loads((OUT / 'provenance.json').read_text())
        raw = (ROOT / 'docs/data/transfer.json').read_bytes()
        self.assertEqual(m['outbound_source_sha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual(m['start_utc'], '2026-10-19T21:00:00Z')
        self.assertEqual(m['end_utc'], '2027-08-29T04:57:00Z')
        self.assertAlmostEqual(m['duration_days'], 313 + 7 / 24 + 57 / 1440)
        self.assertIn('not an official', m['status'])
        self.assertIn('return concept', m['illustrative_elements'])

    def test_svg_and_true_outbound_geometry(self):
        tree = ET.parse(OUT / 'mmx-mission-profile.svg')
        root = tree.getroot()
        self.assertEqual(root.get('viewBox'), '0 0 1600 990')
        self.assertEqual(root.get('width'), '2880')
        paths = root.findall('.//s:path', NS)
        trajectory = next(p for p in paths if p.get('stroke') == '#3987e5' and p.get('stroke-width') == '3')
        points = np.array([[float(x) for x in p.split(',')] for p in trajectory.get('d')[1:].split(' L')])
        d = json.loads((ROOT / 'docs/data/transfer.json').read_text())
        a = np.array(d['states']['mmx'])[:, :3] / d['meta']['au_km']
        e, q = np.deg2rad([23.4392911, -45])
        rotation = np.array([[1, 0, 0], [0, np.cos(e), np.sin(e)], [0, -np.sin(e), np.cos(e)]])
        r = a @ rotation.T
        expected = np.column_stack([490 + 220 * (r[:, 0] * np.cos(q) - r[:, 1] * np.sin(q)),
                                    440 - 220 * .53 * (r[:, 0] * np.sin(q) + r[:, 1] * np.cos(q))])
        self.assertEqual(points.shape, (8503, 2))
        np.testing.assert_allclose(points, expected, atol=.00501, rtol=0)
        labels = ' '.join(t.text or '' for t in root.findall('.//s:text', NS))
        for label in ['C-SMP', 'P-SMP', 'return concept only', '2031', 'Illustration: Mickey']:
            self.assertIn(label, labels)
        self.assertNotIn('MOI at 04:57', labels)

    def test_raster_and_vector_exports(self):
        with Image.open(OUT / 'mmx-mission-profile.png') as image:
            self.assertEqual(image.size, (2880, 1782))
            self.assertAlmostEqual(image.info['dpi'][0], 180, places=1)
            self.assertGreater(len(image.getcolors(maxcolors=1000000) or []), 1000)
        pdf = (OUT / 'mmx-mission-profile.pdf').read_bytes()
        self.assertTrue(pdf.startswith(b'%PDF-'))
        self.assertGreater(len(pdf), 10000)


if __name__ == '__main__':
    unittest.main(verbosity=2)
