"""Run the offline suite from extracted release bytes using existing local deps.

Does not install dependencies, register a host plugin or access hardware.
"""

import argparse, hashlib, json, os, subprocess, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def verify(archive):
    archive = Path(archive).resolve()
    with tempfile.TemporaryDirectory(prefix="cyclo-archive-tests-") as temp:
        with zipfile.ZipFile(archive) as z:
            if {Path(name).parts[0] for name in z.namelist()} != {"cyclo-ai"}:
                raise ValueError("Archive must contain only the cyclo-ai root")
            for name in z.namelist():
                p = Path(name)
                if p.is_absolute() or ".." in p.parts:
                    raise ValueError("Archive path escapes extraction root")
            z.extractall(temp)
        source = Path(temp) / "cyclo-ai"
        # This test-only link is outside the ZIP. Lockfile/dependencies were
        # separately installed locally; no lifecycle/install script is run here.
        (source / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
        env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
        result = subprocess.run(
            ["node", "tests/run.mjs"],
            cwd=source,
            env=env,
            text=True,
            capture_output=True,
            timeout=120,
        )
        evidence = {
            "archive": archive.name,
            "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
            "version": json.loads((source / "plugin.json").read_text(encoding="utf-8"))["version"],
            "exitCode": result.returncode,
            "log": result.stdout + result.stderr,
            "scope": "full offline suite from extracted bytes; reused local lockfile-installed Node dependencies; Xacro import path/environment supplied by caller; no installed-host or hardware claim",
            "suites": json.loads(
                (source / "validation/current/test-results.json").read_text(encoding="utf-8")
            ),
        }
    out = ROOT / "artifacts/extracted-test-results.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in evidence.items() if k not in ["suites", "log"]}, indent=2))
    if result.returncode:
        raise SystemExit(result.returncode)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("archive")
    a = p.parse_args()
    verify(a.archive)
