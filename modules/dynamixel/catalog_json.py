"""Load local byte-verified JSON shards; preserve one logical catalog contract."""

import hashlib
import json
import re
from pathlib import Path, PurePosixPath


def load_json(path):
    path = Path(path).resolve()

    def expand(value):
        if isinstance(value, list):
            return [expand(v) for v in value]
        if not isinstance(value, dict):
            return value
        if "$cycloJson" in value:
            name = value["$cycloJson"]
            if (
                not isinstance(name, str)
                or not name
                or PurePosixPath(name).is_absolute()
                or "\\" in name
                or any(p in ("", ".", "..") for p in name.split("/"))
                or not re.fullmatch(r"[a-f0-9]{64}", value.get("sha256", ""))
            ):
                raise ValueError("Invalid catalog reference path or hash")
            target = (path.parent / name).resolve()
            if not target.is_relative_to(path.parent):
                raise ValueError("Catalog reference path escapes its directory")
            content = target.read_bytes()
            if hashlib.sha256(content).hexdigest() != value["sha256"]:
                raise ValueError("Catalog reference hash mismatch")
            return json.loads(content)
        return {k: expand(v) for k, v in value.items()}

    return expand(json.loads(path.read_text(encoding="utf-8")))


def write_catalog(path, data):
    """Split model/package values without dropping fields, order or provenance."""
    path = Path(path)
    field = "models" if "models" in data else "packages"
    directory = path.parent / path.stem
    directory.mkdir(exist_ok=True)

    def write_part(key, value):
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", str(key)):
            raise ValueError("Invalid catalog shard name")
        name = f"{path.stem}/{key}.json"
        content = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
        if len(content) >= 5 * 1024 * 1024:
            raise ValueError("Catalog shard exceeds 5 MiB")
        (path.parent / name).write_bytes(content)
        return {"$cycloJson": name, "sha256": hashlib.sha256(content).hexdigest()}

    children = data[field]
    refs = (
        [write_part(i, v) for i, v in enumerate(children)]
        if isinstance(children, list)
        else {k: write_part(k, v) for k, v in children.items()}
    )
    path.write_bytes((json.dumps({**data, field: refs}, indent=2) + "\n").encode("utf-8"))
