"""Lossless catalog shards with independent byte-integrity checks."""

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "modules/dynamixel"))
from catalog_json import load_json, write_catalog


class CatalogJson(unittest.TestCase):
    def test_roundtrip_and_tampered_or_escaping_shards(self):
        data = {"version": "0.2.0", "models": [{"items": [1, "모터"]}]}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "control-items.json"
            write_catalog(path, data)
            self.assertEqual(load_json(path), data)
            alternate = Path(tmp) / "custom-output.json"
            write_catalog(alternate, data)
            self.assertEqual(load_json(alternate), data)
            ref = json.loads(path.read_text())["models"][0]
            part = path.parent / ref["$cycloJson"]
            self.assertEqual(hashlib.sha256(part.read_bytes()).hexdigest(), ref["sha256"])
            part.write_text("{}")
            with self.assertRaisesRegex(ValueError, "hash"):
                load_json(path)
            path.write_text(json.dumps({**ref, "$cycloJson": "../escape.json"}))
            with self.assertRaisesRegex(ValueError, "path"):
                load_json(path)
