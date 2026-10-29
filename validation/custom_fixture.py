"""Synthetic external table; not a manufacturer's device specification."""

import hashlib, json
from pathlib import Path


def profile(directory):
    source = Path(directory) / "source.xml"
    source.write_text('<SyntheticTable model="65000"/>')

    def row(name, address, width, access="R", encoding="unsigned", write=None, memory="RAM"):
        x = dict(
            name=name, address=address, width=width, access=access, memory=memory, encoding=encoding
        )
        if write:
            x["write"] = write
        return x

    def rule(kind, bounds, off=True, encoding="unsigned", **kwargs):
        return dict(
            status="resolved",
            kind=kind,
            encoding=encoding,
            bounds=bounds,
            requiresTorqueOff=off,
            **kwargs,
        )

    rows = [
        row("Model Number", 0, 2),
        row("Firmware Version", 6, 1),
        row("ID", 7, 1, "RW", write=rule("id-transition", [0, 252]), memory="EEPROM"),
        row("Baud Rate", 8, 1, "RW", write=rule("baud-transition", [0, 8]), memory="EEPROM"),
        row(
            "Homing Offset",
            52,
            4,
            "RW",
            "twos-complement",
            rule("scalar", [-2147483648, 2147483647], encoding="twos-complement"),
            memory="EEPROM",
        ),
        row("Torque Enable", 512, 1, "RW", write=rule("scalar", [0, 1], off=False, values=[0, 1])),
        row("LED", 513, 1, "RW", write=rule("scalar", [0, 1], off=False)),
        row("Present Position", 552, 4, encoding="twos-complement"),
    ]
    rows[-1].update(unit="degrees", scale=0.0054931640625)
    entry = dict(
        catalogId="custom/synthetic",
        name="Synthetic test device",
        modelNumber=65000,
        firmwares=[6],
        protocol=2,
        bauds={"1000000": 3, "6000000": 8},
        source={"path": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest()},
        items=rows,
    )
    path = Path(directory) / "custom.json"
    path.write_text(json.dumps({"schemaVersion": 1, "models": [entry]}))
    return path, entry
