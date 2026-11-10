"""Offline fixture tests. Fake bytes exercise layout only; no policy is executed."""

import hashlib
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "skills/ai-sapiens-sim2real/scripts/asset_audit.py"
spec = importlib.util.spec_from_file_location("audit", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        self.run = self.root / "run-a"
        (self.run / "exported").mkdir(parents=True)
        (self.run / "params").mkdir()
        self.policy = self.run / "exported/policy.onnx"
        self.config = self.run / "params/sim2real.yaml"
        self.policy.write_bytes(b"offline fixture, not ONNX")
        self.config.write_text("fixture: true\n")
        self.motion = self.root / "converted.csv"
        self.motion.write_text("fixture\n1\n")

    def tearDown(self):
        self.tmp.cleanup()

    def test_velocity_hash_and_no_write(self):
        before = {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        result = module.audit(self.run, "velocity")
        self.assertEqual(
            result["files"]["policy"]["sha256"],
            hashlib.sha256(self.policy.read_bytes()).hexdigest(),
        )
        self.assertEqual(result["status"], "layout_checks_passed")
        self.assertEqual(
            before, {str(p): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        )

    def test_mimic_external_motion_supported_but_requires_review(self):
        result = module.audit(self.run, "mimic", self.motion)
        self.assertIn("motion", result["files"])
        self.assertTrue(result["requires_review"])

    def test_missing_policy(self):
        self.policy.unlink()
        with self.assertRaises(ValueError):
            module.audit(self.run, "velocity")

    def test_empty_config(self):
        self.config.write_bytes(b"")
        with self.assertRaises(ValueError):
            module.audit(self.run, "velocity")

    def test_missing_mimic_motion(self):
        with self.assertRaises(ValueError):
            module.audit(self.run, "mimic")

    def test_wrong_motion_extension(self):
        other = self.root / "motion.npz"
        other.write_bytes(b"fixture")
        with self.assertRaises(ValueError):
            module.audit(self.run, "mimic", other)

    def test_symlink_from_other_run_rejected(self):
        other = self.root / "other.onnx"
        other.write_bytes(b"other run")
        self.policy.unlink()
        self.policy.symlink_to(other)
        with self.assertRaises(ValueError):
            module.audit(self.run, "velocity")

    def test_symlink_directory_rejected(self):
        alias = self.root / "alias"
        alias.symlink_to(self.run, target_is_directory=True)
        with self.assertRaises(ValueError):
            module.audit(alias, "velocity")

    def test_extra_motion_on_velocity_rejected(self):
        with self.assertRaises(ValueError):
            module.audit(self.run, "velocity", self.motion)

    def test_missing_run(self):
        with self.assertRaises(ValueError):
            module.audit(self.root / "missing", "velocity")

    def test_cli_missing_asset_fails_closed(self):
        self.config.unlink()
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--run", str(self.run), "--kind", "velocity"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("blocked", result.stderr)
        self.assertEqual(result.stdout, "")

    def test_untrusted_path_is_literal(self):
        strange = self.root / "run; touch NEVER"
        self.run.rename(strange)
        result = module.audit(strange, "velocity")
        self.assertEqual(result["status"], "layout_checks_passed")
        self.assertFalse((self.root / "NEVER").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
