"""Consistency tests using untrusted fixture manifests, never real policies."""

import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest
import test_asset_audit as fixtures

module = fixtures.module
SCRIPT = fixtures.SCRIPT


class ProvenanceTests(unittest.TestCase):
    setUp = fixtures.AuditTests.setUp
    tearDown = fixtures.AuditTests.tearDown

    def record(self, kind="velocity"):
        data = {
            "schema_version": 1,
            "run_id": self.run.name,
            "kind": kind,
            "task_id": "Cyclo-Velocity-Flat-K1-Rev1-v0",
            "backend": "cyclo-mjlab",
            "robot_revision": "K1-Rev1-FIXTURE",
            "source_commit": "a" * 40,
            "recorded_at": "2026-10-23T10:00:00+00:00",
            "artifacts": {
                "policy": {"sha256": hashlib.sha256(self.policy.read_bytes()).hexdigest()},
                "config": {"sha256": hashlib.sha256(self.config.read_bytes()).hexdigest()},
            },
        }
        if kind == "mimic":
            data["task_id"] = "Cyclo-Mimic-K1-Rev1-Dance1"
            data["artifacts"]["motion"] = {
                "sha256": hashlib.sha256(self.motion.read_bytes()).hexdigest()
            }
        return data

    def write_record(self, data):
        p = self.root / "record.json"
        p.write_text(json.dumps(data))
        return p

    def reject(self, data):
        with self.assertRaises(ValueError):
            module.audit(self.run, "velocity", provenance=self.write_record(data))

    def test_matching_hashes_not_authenticity(self):
        result = module.audit(self.run, "velocity", provenance=self.write_record(self.record()))
        self.assertEqual(result["manifest_consistency"]["status"], "hashes_match_supplied_manifest")
        self.assertFalse(result["provenance_authenticity_verified"])
        self.assertFalse(result["manifest_consistency"]["authenticity_verified"])

    def test_modified_config_rejected(self):
        p = self.write_record(self.record())
        self.config.write_text("different run config")
        with self.assertRaisesRegex(ValueError, "mismatch for config"):
            module.audit(self.run, "velocity", provenance=p)

    def test_modified_policy_rejected(self):
        p = self.write_record(self.record())
        self.policy.write_bytes(b"another run")
        with self.assertRaisesRegex(ValueError, "mismatch for policy"):
            module.audit(self.run, "velocity", provenance=p)

    def test_changed_mimic_motion_rejected(self):
        p = self.write_record(self.record("mimic"))
        self.motion.write_text("different motion")
        with self.assertRaisesRegex(ValueError, "mismatch for motion"):
            module.audit(self.run, "mimic", self.motion, p)

    def test_mimic_manifest_matches(self):
        result = module.audit(
            self.run, "mimic", self.motion, self.write_record(self.record("mimic"))
        )
        self.assertEqual(result["manifest_consistency"]["status"], "hashes_match_supplied_manifest")

    def test_wrong_run_and_kind(self):
        for key, value in [("run_id", "run-b"), ("kind", "mimic")]:
            with self.subTest(key=key):
                data = self.record()
                data[key] = value
                self.reject(data)

    def test_missing_extra_and_invalid_roles(self):
        for mode in ["missing", "extra", "nonobject"]:
            with self.subTest(mode=mode):
                data = self.record()
                if mode == "missing":
                    del data["artifacts"]["config"]
                elif mode == "extra":
                    data["artifacts"]["motion"] = {"sha256": "a" * 64}
                else:
                    data["artifacts"] = []
                self.reject(data)

    def test_invalid_hash(self):
        data = self.record()
        data["artifacts"]["policy"]["sha256"] = "not a hash"
        self.reject(data)

    def test_metadata_constraints(self):
        for key, value in [
            ("task_id", ""),
            ("source_commit", "main"),
            ("backend", "imaginary"),
            ("recorded_at", "2026-10-23T10:00:00"),
            ("recorded_at", "bad"),
            ("schema_version", True),
            ("robot_revision", None),
        ]:
            with self.subTest(key=key, value=value):
                data = self.record()
                data[key] = value
                self.reject(data)

    def test_json_list_and_malformed_rejected(self):
        self.reject([])
        p = self.root / "broken.json"
        p.write_text("{")
        with self.assertRaises(ValueError):
            module.audit(self.run, "velocity", provenance=p)

    def test_manifest_symlink_rejected(self):
        p = self.write_record(self.record())
        alias = self.root / "alias.json"
        alias.symlink_to(p)
        with self.assertRaises(ValueError):
            module.audit(self.run, "velocity", provenance=alias)

    def test_cli_conflict_is_blocked(self):
        data = self.record()
        data["run_id"] = "wrong"
        p = self.write_record(data)
        r = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--run",
                str(self.run),
                "--kind",
                "velocity",
                "--provenance",
                str(p),
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(r.returncode, 2)
        self.assertEqual(r.stdout, "")
        self.assertEqual(json.loads(r.stderr)["status"], "blocked")

    def test_new_manifest_cannot_prove_origin(self):
        self.config.write_text("copied mixed source")
        r = module.audit(self.run, "velocity", provenance=self.write_record(self.record()))
        self.assertFalse(r["provenance_authenticity_verified"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
