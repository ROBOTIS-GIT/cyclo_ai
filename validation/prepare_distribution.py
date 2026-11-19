"""Prepare runnable repository contents from a verified install ZIP; never push."""

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path
from package_runtime import extract_runtime, verify_files


def prepare(archive, destination, source_commit):
    destination = Path(destination)
    if destination.exists():
        raise FileExistsError("Distribution destination already exists")
    if not re.fullmatch(r"[a-f0-9]{40}", source_commit):
        raise ValueError("Pass the exact source commit SHA")
    root = extract_runtime(archive, destination)
    # A distribution branch contains package bytes, never CI workflows that
    # would try to rebuild those already-bundled bytes after a branch push.
    shutil.rmtree(root / ".github", ignore_errors=True)
    manifest = root / "release-files.json"
    names = json.loads(manifest.read_bytes())
    manifest.write_bytes(
        (json.dumps([n for n in names if not n.startswith(".github/")], indent=2) + "\n").encode()
    )
    catalog = root / ".claude-plugin/marketplace.json"
    catalog.parent.mkdir(exist_ok=True)
    catalog.write_bytes(
        (
            json.dumps(
                {
                    "name": "cyclo-ai",
                    "owner": {"name": "ROBOTIS-GIT"},
                    "plugins": [{"name": "cyclo-ai", "source": "./"}],
                },
                indent=2,
            )
            + "\n"
        ).encode()
    )
    (root / "distribution.json").write_bytes(
        (
            json.dumps(
                {
                    "generator": "cyclo-ai-runtime",
                    "sourceRepository": "ROBOTIS-GIT/cyclo_ai",
                    "sourceCommit": source_commit,
                    "version": json.loads((root / "plugin.json").read_bytes())["version"],
                },
                indent=2,
            )
            + "\n"
        ).encode()
    )
    readme = root / "README.md"
    text = readme.read_text(encoding="utf-8")
    note = (
        "\nThis is the generated `claude-dist` distribution branch. Runtime libraries "
        "are included; npm and pip installation are not required. Node.js 22+ and "
        "Python 3.9+ remain prerequisites. Develop against `main`; do not edit "
        "generated files on this branch.\n"
    )
    title, separator, body = text.partition("\n")
    readme.write_bytes((title + "\n" + note + body).encode("utf-8"))
    files = sorted(p for p in root.rglob("*") if p.is_file() and p.name != "runtime-files.json")
    hashes = {
        p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files
    }
    (root / "runtime-files.json").write_bytes((json.dumps(hashes, indent=2) + "\n").encode())
    verify_files(root)
    return root


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--source-commit", required=True)
    args = parser.parse_args()
    print(prepare(args.archive, args.destination, args.source_commit))
