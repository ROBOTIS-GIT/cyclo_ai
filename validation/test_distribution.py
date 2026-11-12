"""Repository distributions must contain the same runnable bytes as install ZIPs."""

import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from prepare_distribution import prepare
from package_runtime import verify_files


class Distribution(unittest.TestCase):
    def test_prepares_repo_catalog_and_updates_integrity_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            files = {
                "plugin.json": json.dumps({"name": "cyclo-ai", "version": "0.2.0"}).encode(),
                "README.md": b"# Cyclo AI\n",
                "modules/dynamixel/runtime-deps.mjs": b"export const bundled = true;\n",
                ".github/workflows/offline.yml": b"name: must not run from distribution\n",
                "release-files.json": json.dumps(
                    ["plugin.json", ".github/workflows/offline.yml"]
                ).encode(),
            }
            files["runtime-files.json"] = json.dumps(
                {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}
            ).encode()
            archive = root / "install.zip"
            with zipfile.ZipFile(archive, "w") as z:
                for name, data in files.items():
                    z.writestr("cyclo-ai/" + name, data)
            output = prepare(archive, root / "prepared", "a" * 40)
            verify_files(output)
            self.assertFalse((output / ".github").exists())
            self.assertEqual(
                (output / "modules/dynamixel/runtime-deps.mjs").read_bytes(),
                files["modules/dynamixel/runtime-deps.mjs"],
            )
            metadata = json.loads((output / "distribution.json").read_bytes())
            self.assertEqual(metadata["sourceCommit"], "a" * 40)
            catalog = json.loads((output / ".claude-plugin/marketplace.json").read_bytes())
            self.assertEqual(catalog["plugins"][0], {"name": "cyclo-ai", "source": "./"})
            self.assertNotIn(
                ".github/workflows/offline.yml",
                json.loads((output / "release-files.json").read_bytes()),
            )
            with self.assertRaises(FileExistsError):
                prepare(archive, root / "prepared", "a" * 40)

    def test_missing_signing_configuration_stops_before_git_changes(self):
        import importlib.util
        from unittest.mock import patch

        script = Path(__file__).resolve().parents[1] / "scripts/publish-claude.py"
        spec = importlib.util.spec_from_file_location("claude_publisher", script)
        publisher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(publisher)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "distribution.json").write_bytes(
                json.dumps(
                    {
                        "sourceRepository": "ROBOTIS-GIT/cyclo_ai",
                        "generator": "cyclo-ai-runtime",
                    }
                ).encode()
            )
            with patch.dict("os.environ", {}, clear=True):
                with self.assertRaisesRegex(ValueError, "Configure release identity"):
                    publisher.publish(root)
            self.assertFalse((root / ".git").exists())
