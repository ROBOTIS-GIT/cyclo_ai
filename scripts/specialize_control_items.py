"""Source-backed non-scalar contracts, using one declarative runtime vocabulary."""

import copy, re
from control_source import numeric_range, dynamic_range, plain


def specialize(entry, m, doc, index, src, facts, supplements):
    items = entry["items"]
    calls = index["files"][doc["sourcePath"]]["calls"]
    paths = {c["path"] for c in calls}
    legacy = "docusaurus/docs/dxl/_partials/ax/control_table.mdx" in paths

    def expr(name, sign=1):
        return {"item": name, "sign": sign}

    def case(when, bounds=None, rangeExpressions=None, **kw):
        return {
            "when": when,
            **({"bounds": bounds} if bounds else {}),
            **({"rangeExpressions": rangeExpressions} if rangeExpressions else {}),
            **kw,
        }

    def ev(p):
        return {"path": p, "blobSha": index["files"][p]["blobSha"], "line": 1}

    def resolve(item, bounds, encoding="unsigned", **kw):
        old = item["write"]
        return {
            "status": "resolved",
            "kind": "direct",
            "encoding": encoding,
            "bounds": bounds,
            "requiresTorqueOff": item["memory"] == "EEPROM" and not legacy,
            "requiresLockZero": item["memory"] == "EEPROM" and "Lock" in m["registers"],
            "sources": old.get("sources", [item["source"]]),
            "warnings": old.get("warnings", []),
            **kw,
        }

    sdk = next(
        (
            p
            for p in supplements["sources"]
            if p["repository"] == "ROBOTIS-GIT/Dynamixel2Arduino"
            and p["path"].endswith("Dynamixel2Arduino.cpp")
        ),
        None,
    )
    for item in items:
        if item["access"] == "R":
            continue
        n = item["name"]
        rule = item["write"]
        text, evidence, unknown = src.section(doc["sourcePath"], item)
        ctx = [c for c in calls if c["path"] in {e["path"] for e in evidence}]
        props = next((e.get("props", {}) for e in evidence if e.get("props")), {})
        raw = item["rawCells"].get("range", "")
        if n.startswith("Indirect "):
            if not any("indirect" in e["path"] for e in evidence):
                for c in calls:
                    if "indirect" in c["path"] and c["path"] in index["files"]:
                        from control_source import render, props_from

                        t, u = render(src.read(c["path"]), props_from(c["propsSource"]))
                        text += "\n" + t
                        unknown += u
                        evidence.append(ev(c["path"]))
            if n.startswith("Indirect Address "):
                ranges = []
                for line in text.splitlines():
                    if line.startswith("|"):
                        for cell in line.split("|"):
                            b = numeric_range(cell)
                            if b:
                                ranges.append(b)
                b = item.get("range")
                for v in ranges:
                    if v[0] >= 8 and v[1] > 255:
                        b = [max(b[0], v[0]), min(b[1], v[1])] if b else v
                if b:
                    rule = resolve(item, b, kind="indirect-map", sources=evidence)
            else:
                rule = resolve(
                    item, [0, 255], kind="indirect-data", requiresTorqueOff=False, sources=evidence
                )
            number = int(n.rsplit(" ", 1)[1])
            if number >= 29 and re.search(r"29\s*~\s*56.*?only.*?Protocol 2", text, re.S | re.I):
                rule["protocols"] = [2]
        if legacy and n in ["CW Angle Limit", "CCW Angle Limit", "Goal Position"]:
            mx = any("/mx/" in p and "angle_limit" in p for p in paths)
            ex = any("/ex/" in p for p in paths) or "/ex_series/" in doc["sourcePath"]
            limit = 4095 if mx or ex else 1023
            if n != "Goal Position":
                rule = resolve(item, [0, limit])
            else:
                wheel = {
                    "all": [
                        {"item": "CW Angle Limit", "equals": 0},
                        {"item": "CCW Angle Limit", "equals": 0},
                    ]
                }
                cases = [case(wheel, [0, limit], effect="ignored in wheel mode")]
                if mx:
                    cases.append(
                        case(
                            {
                                "all": [
                                    {"item": "CW Angle Limit", "equals": 4095},
                                    {"item": "CCW Angle Limit", "equals": 4095},
                                ]
                            },
                            [-28672, 28672],
                            effect="multi-turn raw position",
                        )
                    )
                cases.append(
                    case(
                        {},
                        rangeExpressions={
                            "lower": expr("CW Angle Limit"),
                            "upper": expr("CCW Angle Limit"),
                        },
                    )
                )
                rule = resolve(
                    item,
                    [-28672, 28672] if mx else [0, limit],
                    encoding="twos-complement" if mx else "unsigned",
                    cases=cases,
                )
            if sdk:
                rule["sources"].append(sdk)
        if (
            legacy
            and n == "Moving Speed"
            or "/xl_series/xl320.mdx" in doc["sourcePath"]
            and n == "Moving Speed"
        ):
            wheel = (
                {
                    "all": [
                        {"item": "CW Angle Limit", "equals": 0},
                        {"item": "CCW Angle Limit", "equals": 0},
                    ]
                }
                if legacy
                else {"item": "Control Mode", "equals": 1}
            )
            rule = resolve(
                item,
                [0, 2047],
                cases=[
                    case(
                        wheel, [0, 2047], effect="direction bit10; magnitude0..1023; zero/1024 stop"
                    ),
                    case({}, [0, 1023], effect="unsigned joint speed; raw0 means maximum speed"),
                ],
                rawFormat={
                    "wheel": "direction-bit-10",
                    "magnitudeMask": 1023,
                    "directionMask": 1024,
                },
            )
            if sdk:
                rule["sources"].append(sdk)
        if legacy and n in ["CW Compliance Slope", "CCW Compliance Slope"]:
            rule = resolve(
                item,
                [0, 254],
                normalizationTable=[
                    {"input": [0, 3], "effective": 2},
                    {"input": [4, 7], "effective": 4},
                    {"input": [8, 15], "effective": 8},
                    {"input": [16, 31], "effective": 16},
                    {"input": [32, 63], "effective": 32},
                    {"input": [64, 127], "effective": 64},
                    {"input": [128, 254], "effective": 128},
                ],
            )
        if legacy and n == "Multi Turn Offset":
            rule = resolve(
                item,
                [-24576, 24576],
                encoding="twos-complement",
                sources=rule.get("sources", [item["source"]]) + ([sdk] if sdk else []),
            )
        if legacy and n == "Current":
            rule = {
                "status": "manufacturer-unresolved",
                "reason": "Source marks sensor Current(68) RW but supplies no valid write domain/effect; official typed API does not establish manufacturer write semantics",
                "sources": evidence,
            }
        if n == "Temperature Limit" and legacy and any("/ex/" in p for p in paths):
            rule = resolve(
                item,
                [80, 80],
                warnings=[
                    "Manufacturer explicitly forbids changing either above or below default80; other values lack a permitted documented domain."
                ],
            )
        if n == "ID":
            rule["bounds"] = item["range"] or [0, 252]
        if n == "Baud Rate":
            rule["values"] = sorted(set(m["bauds"].values()))
        if n == "Drive Mode" and rule.get("status") == "resolved":
            own = [c for c in calls if "drivemode" in c["path"] or "drive_mode" in c["path"]]
            cp = own[0]["path"] if own else ""
            if "/x/" in cp:
                rule["minimumFirmware"] = props.get("since", 0)
                bits = {}
                if props.get("timeBasedNote") is not False:
                    bits["4"] = 42
                if rule.get("allowedMask", 0) & 8:
                    bits["8"] = props.get("torqueOnFw", 45)
                rule["bitMinimumFirmware"] = bits
            elif "/mx2/" in cp:
                rule["bitMinimumFirmware"] = {"4": 42}
            elif "/p/" in cp or "/pro/" in cp:
                rule["bitMinimumFirmware"] = {"4": 12}
            rule.setdefault("warnings", []).append(
                "Explicit mode bits can reverse direction, select master/slave, arm torque-on-goal or configure dynamic braking. No other item is changed automatically."
            )
        if n == "Startup Configuration":
            for fix in supplements["resolutions"]:
                if fix["catalogId"] == m["catalogId"] and fix["item"] == n:
                    proofs = [p for p in supplements["sources"] if p["path"] in fix["sourcePaths"]]
                    rule = resolve(
                        item,
                        [0, fix["allowedMask"]],
                        allowedMask=fix["allowedMask"],
                        minimumFirmware=fix["minimumFirmware"],
                        sources=rule.get("sources", [item["source"]]) + proofs,
                    )
            rule.setdefault("warnings", []).append(
                "Changes future boot behavior, including startup torque/RAM restoration where documented; this command does not reboot or start torque now."
            )
        if n == "Drive Mode":
            for fix in supplements["resolutions"]:
                if fix["catalogId"] == m["catalogId"] and fix["item"] == n:
                    proofs = [p for p in supplements["sources"] if p["path"] in fix["sourcePaths"]]
                    rule.update(
                        allowedMask=fix["allowedMask"],
                        bounds=[0, fix["allowedMask"]],
                        sources=rule.get("sources", [item["source"]]) + proofs,
                        sourceConflicts=[{"resolution": fix["basis"]}],
                    )
        if n in ["Profile Acceleration", "Profile Velocity"]:
            is_p = any(
                "/p/" in c["path"] or "/pro/" in c["path"] for c in calls if "profile_" in c["path"]
            )
            is_y = any("/y/" in p for p in paths)
            if not is_y:
                rule = resolve(
                    item,
                    [0, 32767],
                    cases=[
                        case(
                            {
                                "all": [
                                    {
                                        "firmwareAtLeast": 12
                                        if is_p
                                        else m["capabilities"]
                                        .get("profile", {})
                                        .get("driveMinimumFirmware", 0)
                                    },
                                    {"item": "Drive Mode", "mask": 4, "equals": 4},
                                ]
                            },
                            [0, 32737],
                            minimumFirmware=12
                            if is_p
                            else m["capabilities"]
                            .get("profile", {})
                            .get("timeMinimumFirmware", 42),
                            effect="time-based raw milliseconds; acceleration effect capped at half total time",
                        ),
                        case(
                            {},
                            [0, 32767],
                            effect="velocity-based raw profile; zero means infinite/maximum or ignored profile",
                        ),
                    ],
                )
                dyn = dynamic_range(raw)
                if dyn:
                    for e in dyn.values():
                        if "address" in e:
                            match = [i for i in items if i["address"] == e["address"]]
                            if len(match) == 1:
                                e["item"] = match[0]["name"]
                    rule["rangeExpressions"] = dyn
                rule["warnings"].append(
                    "Raw zero is documented and may mean infinite/maximum behavior; no motion goal is issued by a profile store."
                )
        if n == "Bus Watchdog":
            rule = resolve(
                item,
                [0, 127],
                minimumFirmware=rule.get("minimumFirmware", 0),
                warnings=[
                    "0 disables/clears watchdog; raw all-ones is device-owned error status, not a permitted command."
                ],
            )
        if (
            n in ["Goal PWM", "Goal Current", "Goal Velocity", "Goal Position", "Goal Torque"]
            and "Bus Watchdog" in m["registers"]
        ):
            wd = next((i for i in items if i["name"] == "Bus Watchdog"), None)
            rule.pop("forbiddenRawStates", None)
            rule["conditionalForbiddenRawStates"] = [
                {
                    "item": "Bus Watchdog",
                    "values": [(1 << (8 * wd["width"])) - 1] if wd else [255],
                    "minimumFirmware": wd["write"].get("minimumFirmware", 0) if wd else 0,
                }
            ]
        # Mode statements describe application unless the source actually makes
        # a register RO/errors. Preserve raw writes with inactive-effect notes.
        rule.pop("forbiddenBits", None)
        if n.startswith("Goal "):
            rule["warnings"] = rule.get("warnings", []) + [
                "Existing Drive Mode may enable torque on a goal update or otherwise change the command effect; this raw write changes no additional register explicitly."
            ]
        if n == "Goal Position" and "Operating Mode" in m["registers"]:
            if "1,048,575" in text or "1048575" in text:
                rule = resolve(
                    item,
                    [-1048575, 1048575],
                    encoding="twos-complement",
                    cases=[
                        case(
                            {
                                "any": [
                                    {"item": "Operating Mode", "equals": 4},
                                    {"item": "Operating Mode", "equals": 5},
                                ]
                            },
                            [-1048575, 1048575],
                        ),
                        case(
                            {},
                            rangeExpressions={
                                "lower": expr("Min Position Limit"),
                                "upper": expr("Max Position Limit"),
                            },
                        ),
                    ],
                )
            if any("/pro/" in p and "11_opmode_pro" in p for p in paths):
                rule = resolve(
                    item,
                    [-2147483648, 2147483647],
                    encoding="twos-complement",
                    cases=[
                        case({"item": "Operating Mode", "equals": 4}, [-2147483648, 2147483647]),
                        case(
                            {},
                            rangeExpressions={
                                "lower": expr("Min Position Limit"),
                                "upper": expr("Max Position Limit"),
                            },
                        ),
                    ],
                )
            elif rule.get("status") == "resolved" and "rangeExpressions" in rule:
                # Dynamic table bounds remain applicable; mode-specific extended
                # ranges are overridden only where explicitly documented.
                if "1048575" in text:
                    rule["cases"] = [
                        case(
                            {
                                "any": [
                                    {"item": "Operating Mode", "equals": 4},
                                    {"item": "Operating Mode", "equals": 5},
                                ]
                            },
                            [-1048575, 1048575],
                        ),
                        case({}, rangeExpressions=rule["rangeExpressions"]),
                    ]
                    rule.pop("rangeExpressions", None)
                    rule["bounds"] = [-1048575, 1048575]
        if n == "Protocol Type":
            if m["registers"].get("Protocol Type", {}).get("range") == [3, 3]:
                rule = {
                    "status": "manufacturer-unresolved",
                    "reason": "Model row fixes Protocol Type3, description lists2 and TBD10 while Modbus uses distinct firmware identity; no verified handoff/value contract",
                    "sources": evidence,
                }
            elif m["protocols"] == [2]:
                rule = resolve(
                    item,
                    [2, 2],
                    values=[2],
                    warnings=[
                        "Only DYNAMIXEL Protocol2 is established for this firmware identity; Modbus/other firmware recovery is separate."
                    ],
                )
        if n == "Hybrid Save":
            rule["kind"] = "hybrid-save"
            rule["readbackValues"] = [1, 2]
            rule["pendingReadbackValues"] = [1]
            rule["warnings"] = rule.get("warnings", []) + [
                "Observed1 means save processing; observed2 means completed. No automatic retry."
            ]
        if n not in ["Goal PWM", "Goal Current", "Goal Velocity", "Goal Position", "Goal Torque"]:
            rule.pop("forbiddenRawStates", None)
            rule.pop("conditionalForbiddenRawStates", None)
        if any("/y/" in p for p in paths):
            if n in ["Torque Enable", "Goal PWM", "Goal Current", "Goal Velocity", "Goal Position"]:
                rule["forbiddenStates"] = {"Controller State": [4, 6]}
            else:
                rule.pop("forbiddenStates", None)
        if n == "Operating Mode":
            rule.setdefault("warnings", []).append(
                "Changing mode can reset gains/profile/goal settings and position representation; no additional value is restored automatically."
            )
        # Preserve manufacturer unresolved statuses after all generic mechanisms.
        item["write"] = rule
        item["encoding"] = rule.get("encoding", item["encoding"])
        item["range"] = rule.get("bounds", item["range"])
        if rule.get("minimumFirmware"):
            item["minimumFirmware"] = rule["minimumFirmware"]
        if rule.get("protocols"):
            item["protocols"] = rule["protocols"]
