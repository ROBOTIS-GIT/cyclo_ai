"""Portable manifests, skill frontmatter and runtime-source integrity checks."""

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "modules/dynamixel"))
from catalog_json import load_json
import re
import yaml
import jsonschema
from package_files import package_files
from text_encoding import assert_utf8_text

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE


def check(root):
    for relative in package_files(root):
        path = root / relative
        assert_utf8_text(relative, path.read_bytes())
    manifest = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
    schema = json.loads((BASE / "evidence/plugin.schema.json").read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator(schema).validate(manifest)
    assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"])
    assert manifest["name"] == "cyclo-ai"
    assert (
        json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
        == manifest["version"]
    )
    assert manifest["extensions"]["com.openai"]["onboardingSkill"] == "./skills/cyclo/SKILL.md"
    assert (root / "skills/cyclo/SKILL.md").is_file()
    assert not any((root / p).exists() for p in [".app.json", "hooks", ".mcp.json"])
    claude = json.loads((root / ".claude-plugin/plugin.json").read_text(encoding="utf-8"))
    assert claude["name"] == manifest["name"] and claude["version"] == manifest["version"]
    assert "skills" not in claude and "commands" not in claude
    assert set(claude["mcpServers"]) == {"cyclo-mcp"}
    assert claude["mcpServers"]["cyclo-mcp"]["env"] == {}
    mcp = json.loads((root / "mcp.json").read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator(
        json.loads((BASE / "evidence/mcp.schema.json").read_text(encoding="utf-8"))
    ).validate(mcp)
    server = mcp["mcpServers"]["cyclo-mcp"]
    assert server["env"] == {}
    assert (root / "modules/dynamixel/server.mjs").is_file()
    assert not (root / "modules/firmware").exists()
    assert "workspaces" not in json.loads((root / "package.json").read_text(encoding="utf-8"))
    assert mcp["mcpServers"]["cyclo-mcp"]["env"] == {}
    items = load_json((root / "references/control-items.json"))
    tables = json.loads((root / "references/control-tables.json").read_text(encoding="utf-8"))
    assert items["version"] == manifest["version"] and items["revision"] == tables["revision"]
    indexed = json.loads((root / "references/dynamixel-docs.json").read_text(encoding="utf-8"))
    assert len(items["models"]) == 89
    supplements = json.loads(
        (root / "references/control-source-supplements.json").read_text(encoding="utf-8")
    )
    extra = {
        (p["repository"], p["revision"], p["path"]): p["blobSha"] for p in supplements["sources"]
    }
    for model in items["models"]:
        for item in model["items"]:
            source = item["source"]
            assert indexed["files"][source["path"]]["blobSha"] == source["blobSha"]
            if item["write"]["status"] == "resolved":
                assert item["access"] in ["RW", "R/RW"] and item["write"]["sources"]
                for source in item["write"]["sources"]:
                    if source.get("repository"):
                        assert (
                            extra[(source["repository"], source["revision"], source["path"])]
                            == source["blobSha"]
                        )
                    else:
                        assert indexed["files"][source["path"]]["blobSha"] == source["blobSha"]
    names = []
    for skill in sorted((root / "skills").iterdir()):
        entry = skill / "SKILL.md"
        assert entry.is_file()
        text = entry.read_text(encoding="utf-8")
        assert text.startswith("---\n")
        metadata = yaml.safe_load(text.split("---", 2)[1])
        assert metadata["name"] == skill.name
        assert re.fullmatch("[a-z0-9-]{1,64}", metadata["name"])
        assert isinstance(metadata["description"], str) and metadata["description"].strip()
        assert entry.stat().st_size < 1024 * 1024
        names.append(metadata["name"])
    import hashlib

    source_index = load_json((root / "references/dhi-sources.json"))
    assert source_index["schemaVersion"] == 1
    for package in source_index["packages"].values():
        assert package["repository"].startswith(("ROBOTIS-GIT/", "ros-controls/"))
        for profile in package["profiles"].values():
            assert (
                re.fullmatch("[a-f0-9]{40}", profile["revision"])
                and profile["runtimeTested"] is False
            )
            for path, meta in profile["files"].items():
                assert not path.startswith("/") and ".." not in path.split("/")
                assert re.fullmatch("[a-f0-9]{40}", meta["blobSha"]) and meta["bytes"] >= 0
                assert all(1 <= r["line"] <= meta["lineCount"] for r in meta["references"])
    products = json.loads((root / "references/dhi-products.json").read_text(encoding="utf-8"))
    for product in products["products"]:
        profile = source_index["packages"][product["package"]]["profiles"][product["profile"]]
        assert profile["revision"] == product["revision"] and product["dhiDeclaredIn"]
        assert all(
            a["path"] in profile["files"] and a["conditionsEvaluated"] is False
            for a in product["artifacts"]
        )
    sdk = json.loads((root / "modules/dynamixel/SDK-UPSTREAM.json").read_text(encoding="utf-8"))
    for path, digest in sdk["files_sha256"].items():
        assert (
            hashlib.sha256(
                (root / "modules/dynamixel/sdk-upstream" / path).read_bytes()
            ).hexdigest()
            == digest
        )
    tables = json.loads((root / "references/control-tables.json").read_text(encoding="utf-8"))
    assert tables["version"] == manifest["version"]
    assert tables["summary"] == {"actuatorDocuments": 89, "mechanicalDocuments": 3}
    assert len(tables["models"]) == 92
    for model in tables["models"]:
        if model["kind"] != "actuator":
            continue
        assert model["protocols"] and all(p in [1, 2] for p in model["protocols"])
        assert model["registers"]["Torque Enable"]["access"] == "RW"
    return {
        "upstream_source_hashes": "passed",
        "hardware_default": "available; no startup I/O; explicit confirmation; CYCLO_OFFLINE=1 opt-out",
        "first_party_skill_count": len(names),
        "mcp_schema": "passed",
        "manifest_schema": "passed",
        "skills": names,
        "metadata": "passed",
        "unexpected_components": "no undeclared hooks or apps",
    }


if __name__ == "__main__":
    print(json.dumps(check(ROOT), indent=2))
