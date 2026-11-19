"""Compile the complete indexed table inventory and explicit item semantics.

This does not execute MDX or infer missing firmware/mode conditions. A readable
row can be inspected as raw bytes even when its value semantics are unresolved.
Writes require source-bound semantic rules. Unsupported rows remain visible.
"""

import argparse, hashlib, json, re
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "modules/dynamixel"))
from catalog_json import write_catalog
from compile_control_tables import plain, number

ROOT = Path(__file__).resolve().parents[1]


def rows(text):
    headers = None
    memory = None
    for line, s in enumerate(text.splitlines(), 1):
        if s.startswith("#"):
            headers = None
            if "EEPROM" in s:
                memory = "EEPROM"
            elif "RAM" in s:
                memory = "RAM"
        if not s.startswith("|"):
            headers = None
            continue
        cells = [c.strip() for c in s.strip().strip("|").split("|")]
        if any(plain(c) == "Address" for c in cells) and any("Size" in plain(c) for c in cells):
            headers = [plain(c).lower().replace(" ", "") for c in cells]
            continue
        if not headers or len(cells) != len(headers) or number(cells[0]) is None:
            continue
        row = dict(zip(headers, cells))
        name = next((row[k] for k in ["dataname", "name"] if k in row), None)
        if name is None:
            continue
        name = plain(name)
        name = "Baud Rate" if name == "Baud Rate (Bus)" else name
        yield {
            "name": name,
            "address": number(cells[0]),
            "width": next((number(v) for k, v in row.items() if k.startswith("size")), None),
            "access": plain(row.get("access", "")),
            "memory": plain(row.get("area", memory or "unresolved")),
            "sourceLine": line,
            "rawCells": {k: plain(v) for k, v in row.items()},
        }


def compile_items(cache):
    idx = json.loads((ROOT / "references/dynamixel-docs.json").read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / "references/control-tables.json").read_text(encoding="utf-8"))
    models = []

    def source(path):
        b = (cache / path).read_bytes()
        assert (
            hashlib.sha1(f"blob {len(b)}\0".encode() + b).hexdigest()
            == idx["files"][path]["blobSha"]
        ), path
        return b.decode()

    def ev(path):
        return {"path": path, "blobSha": idx["files"][path]["blobSha"]}

    for m in catalog["models"]:
        if m["kind"] != "actuator":
            continue
        doc = next(x for x in idx["models"] if x["id"] == m["catalogId"])
        path = doc["sourcePath"]
        text = source(path)
        raw = list(rows(text))
        items = []
        calls = idx["files"][path]["calls"]
        components = {c["path"] for c in calls}
        modevalues = {}
        mode_source = None
        for p in sorted(components):
            if not any(x in p.split("/")[-1] for x in ["opmode", "operating_mode"]):
                continue
            t = source(p)
            if re.search(r"<Show|\{props|export |\{[a-zA-Z]", t):
                continue
            vals = {}
            for line in t.splitlines():
                match = re.match(r"^\|\s*(\d+)(?:\([^)]*\))?\s*\|\s*([^|]+)\|", line)
                if match and "Control Mode" in match[2]:
                    vals[int(match[1])] = plain(match[2])
            if vals:
                modevalues = vals
                mode_source = p
                break
        for row in raw:
            name = row["name"]
            reg = m["registers"].get(name)
            same = [r for r in raw if r["name"] == name]
            supported = (
                row["width"] is not None
                and 1 <= row["width"] <= 1024
                and row["access"] in ["R", "RW", "R/RW"]
                and row["address"] + row["width"] <= 65536
            )
            rule = {
                "status": "read-only" if row["access"] == "R" else "unresolved",
                "reason": "Read-only source row"
                if row["access"] == "R"
                else "Item-specific encoding, firmware, mode or side-effect semantics remain unresolved; retrieve the exact description before extending metadata",
            }
            encoding = reg["encoding"] if reg else "unresolved"
            bounds = reg["range"] if reg else None
            enums = None
            scale = None

            def resolve(**kw):
                return {
                    "status": "resolved",
                    "kind": "direct",
                    "encoding": encoding,
                    "bounds": bounds,
                    "requiresTorqueOff": row["memory"] == "EEPROM",
                    "sources": [ev(path)],
                    "warnings": [],
                    **kw,
                }

            # This shared component is used by all its actual callers. No model whitelist.
            torque = [p for p in components if ("torque_enable" in p.split("/")[-1])]
            if name == "Torque Enable" and torque and row["width"] == 1:
                p = next(iter(sorted(torque)))
                t = source(p)
                if re.search(r"\|\s*1\s*\|\s*Torque (?:On|ON)", t):
                    rule = resolve(
                        encoding="unsigned",
                        bounds=[0, 1],
                        values=[0, 1],
                        requiresTorqueOff=False,
                        sources=[ev(path), ev(p)],
                        warnings=[
                            "Explicit torque changes may move the mechanism or release a load; present-position representation can change. No implicit goal, torque or brake action is issued."
                        ],
                    )
                    if "/y/" in p:
                        rule.update(
                            forbiddenStates={"Controller State": [4, 6]},
                            warnings=rule["warnings"]
                            + [
                                "Torque transitions affect brake/goal state on applicable Y models. Hybrid persistence is not implicitly saved."
                            ],
                        )
                    encoding = "unsigned"
                    bounds = [0, 1]
                    enums = {"0": "Torque Off", "1": "Torque On"}
            if (
                name == "Operating Mode"
                and modevalues
                and mode_source
                and row["memory"] == "EEPROM"
            ):
                encoding = "unsigned"
                enums = {str(k): v for k, v in modevalues.items()}
                rule = resolve(
                    encoding=encoding,
                    bounds=[min(modevalues), max(modevalues)],
                    values=sorted(modevalues),
                    sources=[ev(path), ev(mode_source)],
                    warnings=[
                        "Changing Operating Mode can reset gains, profile and goal/limit registers and alter position representation. Only this item is written; inspect the returned before/after snapshots before another action."
                    ],
                )
            leaf = {
                "Goal Position": "control_table_goal_position_2",
                "Goal Velocity": "control_table_goal_velocity",
                "Goal Current": "control_table_goal_current",
            }.get(name)
            cp = next(
                (
                    p
                    for p in sorted(components)
                    if "/_partials/x/" in p
                    and leaf
                    and p.split("/")[-1] in [leaf + ".mdx", leaf + "_xl430.mdx"]
                ),
                None,
            )
            if (
                cp
                and modevalues
                and (row["address"], row["width"])
                == {"Goal Current": (102, 2), "Goal Velocity": (104, 4), "Goal Position": (116, 4)}[
                    name
                ]
            ):
                t = source(cp)
                encoding = "twos-complement"
                rule = resolve(
                    encoding=encoding,
                    requiresTorqueOff=False,
                    sources=[ev(path), ev(cp), ev(mode_source)],
                    requiresMode=True,
                    warnings=[
                        "Goal writes can initiate movement when torque is enabled; the executor never enables torque or selects an operating mode implicitly."
                    ],
                )
                if name == "Goal Position":
                    modes = [k for k, v in modevalues.items() if "Position Control Mode" in v]
                    if "_xl430." in cp:
                        modes = [k for k in modes if k != 5]
                    rule.update(
                        modes=modes,
                        modeBounds={
                            str(k): (
                                {"minItem": "Min Position Limit", "maxItem": "Max Position Limit"}
                                if k == 3
                                else {"min": -1048575, "max": 1048575}
                            )
                            for k in modes
                        },
                    )
                    scale = {"value": 0.088, "unit": "degree/pulse"}
                else:
                    match = [
                        k
                        for k, v in modevalues.items()
                        if (
                            "Velocity Control Mode" in v
                            if name == "Goal Velocity"
                            else "Current Control Mode" in v
                            or "Current-based Position Control Mode" in v
                        )
                    ]
                    limit = "Velocity Limit" if name == "Goal Velocity" else "Current Limit"
                    rule.update(modes=match, dynamicLimit=limit)
                    scale = {"value": 0.229, "unit": "rpm/raw"} if name == "Goal Velocity" else None
                    if limit not in m["registers"]:
                        rule = {
                            "status": "unresolved",
                            "reason": "Required dynamic limit register is absent",
                        }
                if not rule.get("modes"):
                    rule = {
                        "status": "unresolved",
                        "reason": "Exact applicable mode enumeration unresolved",
                    }
            if (
                rule.get("status") == "resolved"
                and rule.get("requiresMode")
                and "Drive Mode" in m["registers"]
            ):
                rule["forbiddenBits"] = {"Drive Mode": 8}
                rule["warnings"].append(
                    "Torque-on-by-goal must be inactive; this tool does not implicitly enable torque."
                )
            if name == "ID" and m["capabilities"]["id"]["status"] == "resolved":
                rule = {
                    "status": "resolved",
                    "kind": "id-transition",
                    "encoding": "unsigned",
                    "sources": [ev(path)],
                }
            if name == "Baud Rate" and m["capabilities"]["baud"]["status"] == "resolved":
                rule = {
                    "status": "resolved",
                    "kind": "baud-transition",
                    "encoding": "unsigned",
                    "sources": [ev(path)],
                }
            led = m["capabilities"]["led"]
            if (name == "LED" or name in led.get("channels", [])) and led["status"] == "resolved":
                encoding = "unsigned"
                bounds = (
                    [0, 7] if led.get("colorMask") else [0, 255] if led.get("channels") else [0, 1]
                )
                rule = resolve(encoding=encoding, bounds=bounds, requiresTorqueOff=False)
            if row["access"] == "R":
                rule = {
                    "status": "read-only",
                    "reason": "Official access metadata does not permit writes",
                }
            elif row["access"] == "R/RW":
                rule = {
                    "status": "unresolved",
                    "reason": "Conditional external-port access: verify documented port configuration before defining write semantics",
                }
            if len(same) != 1:
                rule = {
                    "status": "unresolved",
                    "reason": "Duplicate item name in source; no implicit overwrite",
                }
            if not supported:
                rule = {
                    "status": "unresolved",
                    "reason": "Unsupported or unresolved row width/access/address; source row retained",
                }
            if (
                rule.get("status") == "resolved"
                and rule.get("kind") == "direct"
                and row["memory"] not in ["EEPROM", "RAM", "Hybrid"]
            ):
                rule = {"status": "unresolved", "reason": "Unresolved persistence area"}
            items.append(
                {
                    **row,
                    "key": f"{name}@{row['address']}",
                    "source": {**ev(path), "line": row["sourceLine"]},
                    "readStatus": "resolved-raw" if supported and len(same) == 1 else "unresolved",
                    "encoding": encoding,
                    "range": bounds,
                    "enums": enums,
                    "scale": scale,
                    "unit": reg.get("unit") if reg else None,
                    "write": rule,
                }
            )
        models.append({"catalogId": m["catalogId"], "items": items})
    entries = [i for m in models for i in m["items"]]
    return {
        "schemaVersion": 1,
        "version": json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))["version"],
        "revision": idx["revision"],
        "models": models,
        "summary": {
            "actuatorDocuments": len(models),
            "tableRows": len(entries),
            "readableRawRows": sum(i["readStatus"] == "resolved-raw" for i in entries),
            "resolvedWritableRows": sum(i["write"]["status"] == "resolved" for i in entries),
            "unresolvedWritableRows": sum(
                i["access"] in ["RW", "R/RW"] and i["write"]["status"] != "resolved"
                for i in entries
            ),
            "rowsOutsideScalarWidths": sum(i["width"] not in [1, 2, 4] for i in entries),
        },
        "limits": [
            "Inventory counts are source rows, not physical model variants or hardware certification.",
            "Unresolved semantics are shown explicitly; numeric address and RW access alone never authorize writing.",
            "Raw reads do not claim signed/unit interpretation where encoding is unresolved.",
        ],
    }


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("source_cache", type=Path)
    a.add_argument("--output", type=Path, default=ROOT / "references/control-items.json")
    args = a.parse_args()
    result = compile_items(args.source_cache)
    from enrich_control_items import enrich

    result = enrich(
        result,
        json.loads((ROOT / "references/control-tables.json").read_text(encoding="utf-8")),
        json.loads((ROOT / "references/dynamixel-docs.json").read_text(encoding="utf-8")),
        args.source_cache,
    )
    write_catalog(args.output, result)
    print(json.dumps(result["summary"]))
