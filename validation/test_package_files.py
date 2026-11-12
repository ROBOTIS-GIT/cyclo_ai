import json
import tempfile
import unittest
from pathlib import Path
from package_files import package_files
from text_encoding import assert_utf8_text


class ReleaseFiles(unittest.TestCase):
    def test_manifest_ignores_local_profiles_venvs_and_untracked_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            names = ["README.md", "release-files.json"]
            (root / "release-files.json").write_text(json.dumps(names))
            (root / "README.md").write_text("한국어 contribution")
            (root / ".venv").mkdir()
            (root / ".venv/pyvenv.cfg").write_text("local interpreter")
            (root / "customer.local.json").write_text("private profile")
            (root / "customer.xml").write_text("private source")
            self.assertEqual(package_files(root), names)
            for forbidden in [
                "../outside",
                ".venv/pyvenv.cfg",
                "customer.local.json",
                ".env",
                "/absolute",
            ]:
                (root / "release-files.json").write_text(
                    json.dumps(sorted(["release-files.json", forbidden]))
                )
                with self.subTest(path=forbidden), self.assertRaises(ValueError):
                    package_files(root)

    def test_symlink_cannot_smuggle_unlisted_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "secret").write_text("local-only")
            (root / "README.md").symlink_to(root / "secret")
            (root / "release-files.json").write_text(
                json.dumps(["README.md", "release-files.json"])
            )
            with self.assertRaisesRegex(ValueError, "symlink"):
                package_files(root)

    def test_utf8_accepts_all_languages_and_preserves_notices(self):
        assert_utf8_text("README.md", "한국어 日本語 العربية".encode("utf-8"))
        assert_utf8_text("LICENSE", "Copyright 저작권".encode("utf-8"))
        with self.assertRaises(ValueError):
            assert_utf8_text("README.md", "text".encode("utf-16"))

    def test_package_validation_uses_utf8_under_windows_locale(self):
        from unittest.mock import patch
        from validate_package import check, ROOT

        original = Path.read_text

        def windows_read_text(path, encoding=None, errors=None):
            return original(path, encoding=encoding or "cp1252", errors=errors)

        with patch.object(Path, "read_text", windows_read_text):
            self.assertEqual(check(ROOT)["metadata"], "passed")

    def test_source_archive_is_reproducible_and_excludes_local_environment(self):
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
