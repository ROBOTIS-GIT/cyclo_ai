"""Build an install ZIP with pinned libraries; Node and Python stay prerequisites."""

import argparse
import hashlib
import io
import json
import stat
import subprocess
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from package_files import package_files
from validate_package import ROOT, check


def safe_name(name):
    path = PurePosixPath(name)
    if (
        not name
        or path.is_absolute()
        or "\\" in name
        or ":" in name
        or any(p in ("", ".", "..") for p in name.split("/"))
    ):
        raise ValueError(f"Unsafe archive path: {name}")
    return path


def python_files(spec, data):
    if hashlib.sha256(data).hexdigest() != spec["sha256"]:
        raise ValueError("Python dependency hash mismatch")
    package = spec["package"]
    files = {}
    if spec.get("archive", "wheel") == "wheel":
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = [(p.filename, archive.read(p)) for p in archive.infolist() if not p.is_dir()]
        prefix = package + "/"
    else:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            entries = [(p.name, archive.extractfile(p).read()) for p in archive if p.isfile()]
        prefix = spec["sourcePrefix"]
    for name, content in entries:
        safe_name(name)
        if name.startswith(prefix) and name.endswith(".py"):
            files[package + "/" + name[len(prefix) :]] = content
        elif PurePosixPath(name).name in ("LICENSE", "LICENSE.txt"):
            files[package + "/LICENSE.txt"] = content
    if package + "/__init__.py" not in files or package + "/LICENSE.txt" not in files:
        raise ValueError("Python dependency source or license missing")
    return files


def verify_files(root):
    root = Path(root)
    expected = json.loads((root / "runtime-files.json").read_text(encoding="utf-8"))
    actual = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}
    if actual != set(expected) | {"runtime-files.json"}:
        raise ValueError("Runtime file inventory mismatch")
    for name, digest in expected.items():
        safe_name(name)
        path = root / name
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Runtime file hash mismatch: {name}")


def extract_runtime(archive, destination):
    with zipfile.ZipFile(archive) as z:
        names = set()
        size = 0
        for entry in z.infolist():
            path = safe_name(entry.filename)
            size += entry.file_size
            if (
                path.parts[0] != "cyclo-ai"
                or len(path.parts) < 2
                or entry.filename in names
                or stat.S_ISLNK(entry.external_attr >> 16)
                or entry.file_size >= 5 * 1024 * 1024
                or size >= 256 * 1024 * 1024
                or len(names) >= 512
            ):
                raise ValueError("Invalid runtime archive path, type, count or size")
            names.add(entry.filename)
        z.extractall(destination)
    root = Path(destination) / "cyclo-ai"
    verify_files(root)
    return root


def build(root=ROOT, output_dir=None):
    root = Path(root).resolve()
    check(root)
    version = json.loads((root / "plugin.json").read_text(encoding="utf-8"))["version"]
    output_dir = Path(output_dir) if output_dir else root / "artifacts"
    out = output_dir / f"cyclo-ai-{version}-install.zip"
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="cyclo runtime build ") as tmp:
        stage = Path(tmp) / "cyclo-ai"
        stage.mkdir()
        for name in package_files(root):
            path = stage / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((root / name).read_bytes())
        subprocess.run(
            ["node", str(root / "scripts/bundle-runtime.mjs"), str(stage)], cwd=root, check=True
        )
        dependencies = json.loads((stage / "runtime-dependencies.json").read_text(encoding="utf-8"))
        dependencies["python"] = []
        pins = json.loads(
            (root / "modules/dynamixel/python-dependencies.json").read_text(encoding="utf-8")
        )
        for name, spec in pins.items():
            # Build-time only. Never run pip, setup.py or downloaded code.
            if not spec["url"].startswith("https://files.pythonhosted.org/"):
                raise ValueError("Python source must come from the pinned PyPI download host")
            with urllib.request.urlopen(spec["url"], timeout=30) as response:
                data = response.read(5 * 1024 * 1024)
            for relative, content in python_files(spec, data).items():
                path = stage / "modules/dynamixel/python-vendor" / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            dependencies["python"].append({"name": name, **spec})
        (stage / "runtime-dependencies.json").write_bytes(
            (json.dumps(dependencies, indent=2) + "\n").encode("utf-8")
        )
        files = sorted(p.relative_to(stage).as_posix() for p in stage.rglob("*") if p.is_file())
        hashes = {name: hashlib.sha256((stage / name).read_bytes()).hexdigest() for name in files}
        (stage / "runtime-files.json").write_bytes(
            (json.dumps(hashes, indent=2) + "\n").encode("utf-8")
        )
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
            for name in sorted(files + ["runtime-files.json"]):
                info = zipfile.ZipInfo("cyclo-ai/" + name, date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                archive.writestr(info, (stage / name).read_bytes())
        with tempfile.TemporaryDirectory(prefix="cyclo runtime extract ") as extracted:
            extract_runtime(out, extracted)
        result = {
            "artifact": out.name,
            "bytes": out.stat().st_size,
            "sha256": hashlib.sha256(out.read_bytes()).hexdigest(),
            "files": len(files) + 1,
            "runtimeLibraries": dependencies,
            "requires": {"node": ">=22", "python": ">=3.9"},
        }
    (output_dir / "runtime-package-result.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({k: v for k, v in result.items() if k != "runtimeLibraries"}, indent=2))
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    build(output_dir=args.output_dir)
