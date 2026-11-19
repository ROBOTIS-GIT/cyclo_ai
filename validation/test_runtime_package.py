"""Install archives must contain intact dependencies and no escaping entries."""

import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from package_runtime import python_files, verify_files, extract_runtime


class RuntimePackage(unittest.TestCase):
    def test_python_archive_hash_and_license_are_required(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("serial/__init__.py", "VERSION='3.5'\n")
            archive.writestr("pyserial-3.5.dist-info/LICENSE.txt", "BSD license")
        data = buffer.getvalue()
        spec = {"package": "serial", "sha256": hashlib.sha256(data).hexdigest()}
        files = python_files(spec, data)
        self.assertIn("serial/__init__.py", files)
        self.assertEqual(files["serial/LICENSE.txt"], b"BSD license")
        with self.assertRaisesRegex(ValueError, "hash"):
            python_files({**spec, "sha256": "0" * 64}, data)

    def test_runtime_inventory_detects_modified_and_extra_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = b"runtime bytes"
            (root / "server.mjs").write_bytes(data)
            (root / "runtime-files.json").write_text(
                json.dumps(
                    {
                        "server.mjs": hashlib.sha256(data).hexdigest(),
                    }
                )
            )
            verify_files(root)
            (root / "server.mjs").write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "hash"):
                verify_files(root)
            (root / "server.mjs").write_bytes(data)
            (root / "private.local.json").write_text("customer data")
            with self.assertRaisesRegex(ValueError, "inventory"):
                verify_files(root)

    def test_archive_traversal_duplicate_and_symlink_are_rejected(self):
        for name in ["cyclo-ai/../escape", "elsewhere/file", "cyclo-ai/dir\\escape"]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                archive = Path(tmp) / "test.zip"
                with zipfile.ZipFile(archive, "w") as z:
                    z.writestr(name, "bad")
                with self.assertRaisesRegex(ValueError, "path"):
                    extract_runtime(archive, Path(tmp) / "output")

    def test_duplicate_and_symlink_entries_are_rejected(self):
        for kind in ["duplicate", "symlink"]:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as tmp:
                archive = Path(tmp) / "test.zip"
                with zipfile.ZipFile(archive, "w") as z:
                    if kind == "duplicate":
                        import warnings

                        with warnings.catch_warnings():
                            warnings.simplefilter("ignore", UserWarning)
                            z.writestr("cyclo-ai/file", "one")
                            z.writestr("cyclo-ai/file", "two")
                    else:
                        info = zipfile.ZipInfo("cyclo-ai/file")
                        info.create_system = 3
                        info.external_attr = 0o120777 << 16
                        z.writestr(info, "outside")
                with self.assertRaisesRegex(ValueError, "path"):
                    extract_runtime(archive, Path(tmp) / "output")
