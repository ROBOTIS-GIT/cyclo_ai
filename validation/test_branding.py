"""Current product identity and archive root, without rewriting historic evidence."""

import json, re, unittest, importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Branding(unittest.TestCase):
    def test_one_current_identity(self):
        for path in ["plugin.json", ".claude-plugin/plugin.json"]:
            self.assertEqual(json.loads((ROOT / path).read_text())["name"], "cyclo-ai")
        self.assertFalse((ROOT / "MIGRATION.md").exists())
        for path in [
            "README.md",
            "references/hosts.md",
            "references/first-run.md",
            "validation/package_release.py",
            "validation/verify_archive.py",
        ]:
            self.assertNotIn("ai-" + "sapiens-dev", (ROOT / path).read_text())

    def test_no_active_legacy_identity(self):
        for directory in ["skills", "references", "modules"]:
            for p in (ROOT / directory).rglob("*"):
                if not p.is_file() or any(x in p.parts for x in ["__pycache__", "dist"]):
                    continue
                try:
                    text = p.read_text()
                except UnicodeError:
                    continue
                self.assertNotIn("ai-" + "sapiens-dev", text, str(p))
        catalog = json.loads((ROOT / ".agents/plugins/marketplace.json").read_text())
        self.assertEqual(catalog["plugins"][0]["name"], "cyclo-ai")
        self.assertEqual(catalog["plugins"][0]["source"]["path"], "./")

    def test_readme_presentation_has_no_release_labels(self):
        text = (ROOT / "README.md").read_text()
        self.assertEqual(text.splitlines()[0], "# Cyclo AI")
        # Historical evidence paths may retain versions; display text must not label releases.
        visible = re.sub(r"\]\([^)]*\)", "]", text)
        self.assertNotRegex(visible, r"\b0\.[0-9]+\.[0-9]+\b")

    def test_real_ai_sapiens_tasks_are_preserved(self):
        self.assertEqual(len(list((ROOT / "skills").glob("ai-sapiens-*/SKILL.md"))), 9)
        self.assertEqual(len(list((ROOT / "skills").glob("*/SKILL.md"))), 28)

    def test_ai_worker_tasks_are_discoverable(self):
        import yaml

        expected = {
            "ai-worker",
            "ai-worker-setup",
            "ai-worker-control",
            "ai-worker-teleop",
            "ai-worker-learning",
        }
        self.assertEqual(
            {p.parent.name for p in (ROOT / "skills").glob("ai-worker*/SKILL.md")}, expected
        )
        for name in expected:
            entry = ROOT / "skills" / name / "SKILL.md"
            self.assertEqual(yaml.safe_load(entry.read_text().split("---", 2)[1])["name"], name)
            ui = yaml.safe_load((entry.parent / "agents/openai.yaml").read_text())
            self.assertIn("$" + name, ui["interface"]["default_prompt"])

    def test_archive_root_is_explicit_product_identity(self):
        import hashlib
        import os
        import tempfile
        import zipfile
        from unittest.mock import patch
        from package_release import build

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "plugin.json").write_text(json.dumps({"version": "0.0.0"}))
            (root / "release-files.json").write_text(
                json.dumps(["plugin.json", "release-files.json"])
            )
            (root / ".venv").mkdir()
            (root / ".venv" / "private.txt").write_text("local-only")
            with patch("package_release.check"):
                archive = build(root)
                first = hashlib.sha256(archive.read_bytes()).hexdigest()
                os.utime(root / "plugin.json", (1234567890, 1234567890))
                self.assertEqual(hashlib.sha256(build(root).read_bytes()).hexdigest(), first)
            with zipfile.ZipFile(archive) as z:
                self.assertEqual(
                    z.namelist(), ["cyclo-ai/plugin.json", "cyclo-ai/release-files.json"]
                )
