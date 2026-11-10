"""Build a reproducible source ZIP from the reviewed release manifest."""

import argparse
import hashlib
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path
from package_files import MANIFEST, allowed, package_files
from validate_package import ROOT, check


def refresh_manifest(root):
    # Only explicitly tracked files are eligible. Stage intentional additions first.
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
    names = sorted({n for n in tracked if n and allowed(n) and (root / n).is_file()} | {MANIFEST})
    (root / MANIFEST).write_text(json.dumps(names, indent=2) + "\n", encoding="utf-8")
    package_files(root)
    print(f"Updated {MANIFEST}: {len(names)} files. Review the diff before release.")


def build(root=ROOT):
    root = Path(root).resolve()
    check(root)
    files = package_files(root)
    version = json.loads((root / "plugin.json").read_text())["version"]
    out = root / "artifacts" / f"cyclo-plugin-{version}.zip"
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            info = zipfile.ZipInfo("cyclo-plugin/" + name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (root / name).read_bytes())
    with zipfile.ZipFile(out) as archive:
        assert archive.testzip() is None
        with tempfile.TemporaryDirectory(prefix="cyclo-release-check-") as temp:
            archive.extractall(temp)
            extracted = Path(temp) / "cyclo-plugin"
            check(extracted)
            for name in files:
                assert (root / name).read_bytes() == (extracted / name).read_bytes()
    result = {
        "artifact": out.name,
        "bytes": out.stat().st_size,
        "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
        "files": len(files),
        "zip_crc": "passed",
        "extracted_schema_reference_and_source_hash_checks": "passed",
        "byte_comparison": "passed",
    }
    (root / "artifacts/package-result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh-manifest", action="store_true")
    args = parser.parse_args()
    if args.refresh_manifest:
        refresh_manifest(ROOT)
    else:
        build()
