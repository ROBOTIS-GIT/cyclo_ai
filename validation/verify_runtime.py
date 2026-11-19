"""Verify install ZIP without npm/pip installs, site packages or source-tree links."""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from package_runtime import extract_runtime, verify_files

ROOT = Path(__file__).resolve().parents[1]


def verify(archive, result_dir=None):
    archive = Path(archive).resolve()
    with tempfile.TemporaryDirectory(prefix="cyclo installed cache with spaces ") as tmp:
        if archive.is_dir():
            root = Path(tmp) / "cyclo-ai"
            shutil.copytree(archive, root, ignore=shutil.ignore_patterns(".git"))
            verify_files(root)
        else:
            root = extract_runtime(archive, tmp)
        if (root / "node_modules").exists() or (root / ".venv").exists():
            raise ValueError("Install ZIP must not reuse a development environment")
        env = {
            key.upper(): value
            for key, value in os.environ.items()
            if key.upper()
            in {
                "PATH",
                "HOME",
                "SYSTEMROOT",
                "WINDIR",
                "TEMP",
                "TMP",
            }
        }
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        python = str(Path(sys.executable).resolve())
        probe = """
import json,sys
from pathlib import Path
root=Path(sys.argv[1])
sys.path.insert(0,str(root/'modules/dynamixel'))
sys.path.insert(0,str(root/'modules/dynamixel/python-vendor'))
import serial,yaml,sdk_bridge
assert serial.VERSION == '3.5'
assert yaml.__version__ == '6.0.3'
assert Path(serial.__file__).is_relative_to(root)
assert Path(yaml.__file__).is_relative_to(root)
assert sdk_bridge.sdk().PortHandler
assert len(sdk_bridge.Bridge(sdk_bridge.sdk()).inventory()['models']) == 89
assert yaml.safe_load('joint: {id: 1}') == {'joint': {'id': 1}}
print('Isolated Python: bundled pyserial, PyYAML, official SDK and catalog loaded; no device opened.')
"""
        logs = []
        for command in [
            [python, "-I", "-S", "-B", "-c", probe, str(root)],
            ["node", str(root / "scripts/doctor.mjs"), "--hardware-deps"],
            ["node", str(ROOT / "validation/runtime-smoke.mjs"), str(root)],
        ]:
            result = subprocess.run(
                command, cwd=tmp, env=env, text=True, capture_output=True, timeout=60
            )
            logs.append(result.stdout + result.stderr)
            if result.returncode:
                raise RuntimeError("Install ZIP verification failed:\n" + logs[-1])
        verify_files(root)
        evidence = {
            "artifact": archive.name,
            "sha256": hashlib.sha256(
                (archive / "runtime-files.json").read_bytes()
                if archive.is_dir()
                else archive.read_bytes()
            ).hexdigest(),
            "hashKind": "file inventory" if archive.is_dir() else "archive",
            "scope": "Extracted install ZIP; no dependency installation or source-tree links; isolated Python; both host MCP declarations; no device I/O",
            "status": "passed",
            "logs": logs,
        }
    out = (Path(result_dir) if result_dir else ROOT / "artifacts") / "runtime-test-results.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in evidence.items() if k != "logs"}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", help="Install ZIP or prepared repository directory")
    parser.add_argument("--result-dir", type=Path)
    args = parser.parse_args()
    verify(args.archive, result_dir=args.result_dir)
