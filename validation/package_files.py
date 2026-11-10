"""An explicit, portable release inventory shared by validation and packaging."""

import json
from pathlib import Path, PurePosixPath

MANIFEST = "release-files.json"
EXCLUDED = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "artifacts",
    "__pycache__",
    "dist",
    "work",
    "current",
}


def allowed(name):
    path = PurePosixPath(name)
    return (
        not path.is_absolute()
        and ".." not in path.parts
        and "\\" not in name
        and not any(part in EXCLUDED or part.startswith(".mock-tests-") for part in path.parts)
        and not path.name.startswith(".env")
        and not path.name.endswith((".pyc", ".local.json"))
    )


def package_files(root):
    root = Path(root).resolve()
    names = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if not isinstance(names, list) or not names or any(not isinstance(n, str) for n in names):
        raise ValueError("Release manifest must be a nonempty list of file paths")
    if names != sorted(set(names)) or MANIFEST not in names:
        raise ValueError("Release manifest must be sorted, unique and include itself")
    for name in names:
        if not allowed(name):
            raise ValueError(f"Local or unsafe path in release manifest: {name}")
        path = root / name
        if any(p.is_symlink() for p in [path, *path.parents] if p != root and root in p.parents):
            raise ValueError(f"Release files cannot traverse symlinks: {name}")
        if not path.is_file() or not path.resolve().is_relative_to(root):
            raise ValueError(f"Missing or escaping release file: {name}")
    return names
