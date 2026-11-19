"""Private stdio adapter to the pinned official SDK. Not a public raw-write CLI.

Only launched for an explicitly requested product-provider operation.
No port is enumerated/opened on import. Tests use fake ports and packets only.
"""

import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "sdk-upstream"))
sys.path.insert(1, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "python-vendor"))
from catalog_json import load_json
from custom_tables import load_custom
from transports import port_class
from table_conditions import scalar as table_scalar, live as table_live


class DeviceStatusError(RuntimeError):
    pass


class CommunicationError(RuntimeError):
    def __init__(self, message, result):
        super().__init__(message)
        self.result = result


def sdk():
    try:
        import dynamixel_sdk as api

        return api
    except ImportError as e:
        raise RuntimeError(
            "Missing pyserial==3.5. Use the install ZIP with bundled libraries, or run npm run setup in a source checkout. No global installation is performed."
        ) from e


def raw_ping(handler, port, device_id, protocol):
    """Use SDK packet parsing; P1 presence must not depend on its extra model READ."""
    if protocol not in [1, 2] or not 0 <= device_id <= (253 if protocol == 1 else 252):
        raise ValueError("Bounded unicast Protocol 1/2 only")
    tx = [0] * (6 if protocol == 1 else 10)
    if protocol == 1:
        tx[2] = device_id
        tx[3] = 2
        tx[4] = 1
    else:
        tx[4] = device_id
        tx[5] = 3
        tx[7] = 1
    packet, result, error = handler.txRxPacket(port, tx)
    if result == -3001:
        return None
    if result != 0:
        raise RuntimeError("Ping communication error: " + handler.getTxRxResult(result))
    actual = packet[2 if protocol == 1 else 4]
    if actual != device_id:
        raise RuntimeError("Unexpected status responder ID")
    out = {"id": actual, "present": True}
    if error:
        return {**out, "statusError": handler.getRxPacketError(error)}
    if protocol == 2:
        if len(packet) < 14:
            raise RuntimeError("Incomplete Protocol 2 Ping identity payload")
        out.update(modelNumber=packet[9] | packet[10] << 8, firmwareVersion=packet[11])
    return out


class Bridge:
    def __init__(self, api):
        self.api = api
        self.port = None
        self.handler = None
        self.protocol = None
        self.bound = None
        self._catalog = None
        self._inventory = None
        self._last_write_item = None
        self.custom = load_custom(__import__("os").environ.get("CYCLO_PRODUCTS_CUSTOM_TABLES"))

    def command(self, r):
        op = r["op"]
        if op == "ports":
            from serial.tools import list_ports

            return [
                {
                    "path": p.device,
                    "description": p.description,
                    "serialNumber": p.serial_number,
                    "manufacturer": p.manufacturer,
                    "product": p.product,
                    "interface": p.interface,
                    "location": p.location,
                    "vid": p.vid,
                    "pid": p.pid,
                }
                for p in list_ports.comports()
            ]
        if op == "open":
            if self.port is not None:
                raise ValueError("Close the existing transport first")
            protocol = r["protocol"]
            if protocol not in [1, 2]:
                raise ValueError("Explicit Protocol 1 or 2 is required; SDK fallback is prohibited")
            timeout = r.get("timeoutMs", 100)
            if not 10 <= timeout <= 200:
                raise ValueError("Invalid bounded packet timeout")
            api = self.api

            class BoundedPort(port_class(api, r["port"])):
                def setPacketTimeout(self, packet_length):
                    self.setPacketTimeoutMillis(timeout)

            self.port = BoundedPort(r["port"])
            self.handler = api.PacketHandler(protocol)
            if protocol == 2:
                # This pinned SDK's txPacket ignores addStuffing's returned buffer.
                # Preserve the SDK algorithm while making its result visible in place.
                sdk_add_stuffing = self.handler.addStuffing

                def add_stuffing_in_place(packet):
                    packet[:] = sdk_add_stuffing(packet)
                    return packet

                self.handler.addStuffing = add_stuffing_in_place
            self.protocol = protocol
            try:
                if not self.port.setBaudRate(r["baud"]):
                    raise RuntimeError("Official SDK does not support this host baud")
            except Exception:
                self.close()
                raise
            return {"opened": True}
        if op == "close":
            self.close()
            return {"closed": True}
        if self.port is None:
            raise ValueError("No open transport")
        if op == "canBaud":
            return self.port.getCFlagBaud(r["baud"]) > 0
        if op in ["ping", "probe"]:
            return raw_ping(self.handler, self.port, r["id"], self.protocol)
        if op == "read":
            return self.read(r["id"], r["address"], r["size"])
        if op == "syncRead":
            ids = r["ids"]
            address = r["address"]
            size = r["size"]
            if (
                self.protocol != 2
                or not isinstance(ids, list)
                or not 1 <= len(ids) <= 16
                or len(set(ids)) != len(ids)
                or any(type(i) is not int or not 0 <= i <= 252 for i in ids)
                or type(size) is not int
                or not 1 <= size <= 1024
                or size * len(ids) > 4096
                or type(address) is not int
                or not 0 <= address <= 65536 - size
            ):
                raise ValueError("Invalid bounded Protocol2 Sync Read")
            self.check(self.handler.syncReadTx(self.port, address, size, ids, len(ids), False), 0)
            responses = []
            for device_id in ids:
                data, result, error = self.handler.readRx(self.port, device_id, size)
                self.check(result, error)
                if len(data) != size:
                    raise RuntimeError("Sync Read width mismatch")
                responses.append({"id": device_id, "bytes": data})
            return responses
        if op == "writeGroup":
            return self.write_group(r)
        if op == "bulkRead":
            return self.bulk_read(r["entries"])
        if op == "bind":
            catalog = self.catalog()
            m = next(
                (
                    m
                    for m in catalog["models"]
                    if m["catalogId"] == r["catalogId"]
                    and m["kind"] in ["actuator", "controller", "sensor"]
                ),
                None,
            )
            if not m or self.protocol not in m["protocols"] or r["model"] not in m["modelNumbers"]:
                raise ValueError("Invalid source-bound identity")
            if m.get("customHash") and (
                r.get("tableHash") != m["customHash"] or r["firmware"] not in m["customFirmwares"]
            ):
                raise ValueError("Custom contract hash/firmware changed")
            if m["dualAxis"] and (
                len(r.get("peerIds", [])) != 1 or r["id"] in r.get("peerIds", [])
            ):
                raise ValueError("Distinct dual-axis peer cohort is required")
            for device_id in [r["id"]] + r.get("peerIds", []):
                proof = raw_ping(self.handler, self.port, device_id, self.protocol)
                if not proof:
                    raise RuntimeError("Identity disappeared before binding")
                if r.get("identityMode") == "ping-payload":
                    if (
                        self.protocol != 2
                        or proof.get("modelNumber") != r["model"]
                        or proof.get("firmwareVersion") != r["firmware"]
                    ):
                        raise ValueError(
                            "Read-unavailable identity requires exact Protocol2 Ping model/firmware"
                        )
                    continue
                model = int.from_bytes(bytes(self.read(device_id, 0, 2)), "little")
                fw = m["registers"]["Firmware Version"]
                firmware = int.from_bytes(
                    bytes(self.read(device_id, fw["address"], fw["width"])), "little"
                )
                if model != r["model"] or firmware != r["firmware"]:
                    raise ValueError("Binding identity mismatch")
            self.bound = (m, r)
            return {"bound": True}
        if op == "write":
            self.validate_write(r)
            item = self._last_write_item
            no_reply = r.get("expectStatus") is False
            if no_reply:
                rule = item["write"] if item else {}
                intended = item and (
                    rule["kind"] == "protocol-transition"
                    or rule["kind"] == "return-level"
                    and int.from_bytes(bytes(r["data"]), "little") < 2
                )
                m, b = self.bound
                status = m["registers"].get("Status Return Level")
                current = (
                    0
                    if b.get("identityMode") == "ping-payload"
                    else int.from_bytes(
                        bytes(self.read(b["id"], status["address"], status["width"])), "little"
                    )
                    if status
                    else 2
                )
                if not intended and current != 1 and b.get("identityMode") != "ping-payload":
                    raise ValueError(
                        "Tx-only requires a documented current/new reply policy or protocol transition"
                    )
                result = self.handler.writeTxOnly(
                    self.port, r["id"], r["address"], len(r["data"]), r["data"]
                )
                self.check(result, 0)
                return {
                    "transmitted": True,
                    "acknowledgement": "not requested under documented reply/transition policy",
                }
            result, error = self.handler.writeTxRx(
                self.port, r["id"], r["address"], len(r["data"]), r["data"]
            )
            self.check(result, error)
            return {"acknowledged": True}
        raise ValueError(
            "Unsupported bridge operation; use a source-bound item, not an arbitrary protocol command"
        )

    def write_group(self, request):
        """Validate every named target before one SDK group packet; never retry."""
        result = {"outcome": "not_written", "items": [], "transmission": {"attempted": False}}
        saved_bound = self.bound
        try:
            entries = request["entries"]
            if not isinstance(entries, list) or not 2 <= len(entries) <= 253:
                raise ValueError("Choose 2..253 distinct primary targets")
            ids = [e["id"] for e in entries]
            if len(set(ids)) != len(ids) or any(
                type(i) is not int or not 0 <= i <= (253 if self.protocol == 1 else 252)
                for i in ids
            ):
                raise ValueError("Invalid group primary IDs")
            plans = []
            for e in entries:
                if e.get("identityMode") or type(e.get("value")) is not int:
                    raise ValueError(
                        "Group writes require readable identities and raw integer values"
                    )
                self.command({**e, "op": "bind"})
                m, b = self.bound
                inventory = next(
                    x for x in self.inventory()["models"] if x["catalogId"] == m["catalogId"]
                )
                item = next((x for x in inventory["items"] if x["key"] == e["tableItem"]), None)
                if (
                    not item
                    or item["memory"] != "RAM"
                    or item["write"].get("kind") != "direct"
                    or item["readStatus"] != "resolved-raw"
                ):
                    raise ValueError("Group writes require a direct readable RAM item")
                import re

                if re.search(
                    r"^(Profile |.*Limit$|.*Mode.*|Lock$|.*Watchdog$|Secondary)", item["name"]
                ):
                    raise ValueError("Configuration side effects are not group writable")
                data = list(
                    e["value"].to_bytes(
                        item["width"],
                        "little",
                        signed=item["write"]["encoding"] == "twos-complement",
                    )
                )
                payload = {"id": e["id"], "address": item["address"], "data": data}
                self.validate_write(payload)
                before = self.read(e["id"], item["address"], item["width"])
                plans.append((e, item, payload))
                result["items"].append(
                    {
                        "id": e["id"],
                        "item": item["key"],
                        "requested": e["value"],
                        "before": before,
                        "verification": "pending",
                    }
                )
            if len({item["name"] for _, item, _ in plans}) != 1:
                raise ValueError("Group writes require one common named item")
            same = all(
                i["address"] == plans[0][1]["address"] and i["width"] == plans[0][1]["width"]
                for _, i, _ in plans
            )
            instruction = "syncWrite" if same else "bulkWrite"
            if request.get("instruction") != instruction or not same and self.protocol != 2:
                raise ValueError("Unsupported group instruction/layout")
            first = plans[0][1]
            params = (
                (
                    [first["address"], first["width"]]
                    if self.protocol == 1
                    else [
                        first["address"] & 255,
                        first["address"] >> 8,
                        first["width"] & 255,
                        first["width"] >> 8,
                    ]
                )
                if same
                else []
            )
            for e, item, payload in plans:
                if self.protocol == 1 and (
                    item["address"] + item["width"] > 256 or item["width"] > 255
                ):
                    raise ValueError("Protocol1 address bounds exceeded")
                params.append(e["id"])
                if not same:
                    params.extend(
                        [
                            item["address"] & 255,
                            item["address"] >> 8,
                            item["width"] & 255,
                            item["width"] >> 8,
                        ]
                    )
                params.extend(payload["data"])
            body = [0x83 if same else 0x93] + params
            stuffing = (
                sum(body[n - 2 : n + 1] == [255, 255, 253] for n in range(2, len(body)))
                if self.protocol == 2
                else 0
            )
            packet_bytes = (6 if self.protocol == 1 else 10) + len(params) + stuffing
            if packet_bytes > (250 if self.protocol == 1 else 1024):
                raise ValueError("Group request exceeds one SDK packet; no splitting")
            group = (
                self.api.GroupSyncWrite(self.port, self.handler, first["address"], first["width"])
                if same
                else self.api.GroupBulkWrite(self.port, self.handler)
            )
            for e, item, payload in plans:
                added = (
                    group.addParam(e["id"], payload["data"])
                    if same
                    else group.addParam(e["id"], item["address"], item["width"], payload["data"])
                )
                if not added:
                    raise ValueError("SDK rejected group parameters")
            # Recheck all bindings and prerequisites after assembling the complete group.
            for e, _, payload in plans:
                self.command({**e, "op": "bind"})
                self.validate_write(payload)
            result["identityVerifiedBefore"] = True
            result["instruction"] = instruction
            result["packetBytes"] = packet_bytes
            result["transmission"] = {
                "attempted": True,
                "acknowledgement": "none: broadcast group write",
            }
            self.check(group.txPacket(), 0)
            result["transmission"]["transmitted"] = True
            for n, (e, item, _) in enumerate(plans):
                try:
                    self.command({**e, "op": "bind"})
                    data = self.read(e["id"], item["address"], item["width"])
                    value = int.from_bytes(
                        bytes(data), "little", signed=item["write"]["encoding"] == "twos-complement"
                    )
                    rule = item["write"]
                    equivalent = next(
                        (
                            x["effective"]
                            for x in rule.get("normalizationTable", [])
                            if x["input"][0] <= e["value"] <= x["input"][1]
                        ),
                        None,
                    )
                    verified = (
                        value == e["value"]
                        or value in rule.get("readbackValues", [])
                        or value == equivalent
                    )
                    result["items"][n].update(
                        observed=value,
                        bytes=data,
                        verification="verified" if verified else "mismatch",
                    )
                except Exception as error:
                    result["items"][n].update(verification="unknown", error=str(error))
            result["outcome"] = (
                "verified"
                if all(x["verification"] == "verified" for x in result["items"])
                else "uncertain"
            )
        except Exception as error:
            result["outcome"] = (
                "uncertain" if result["transmission"]["attempted"] else "not_written"
            )
            result["error"] = str(error)
        finally:
            self.bound = saved_bound
            self._last_write_item = None
        return result

    def bulk_read(self, entries):
        if not isinstance(entries, list) or not 2 <= len(entries) <= 16:
            raise ValueError("Bulk Read requires 2..16 entries per batch")
        ids = [e["id"] for e in entries]
        if len(set(ids)) != len(ids) or any(
            type(i) is not int or not 0 <= i <= (253 if self.protocol == 1 else 252) for i in ids
        ):
            raise ValueError("Invalid Bulk Read IDs")
        params = []
        total = 0
        for e in entries:
            address, size = e["address"], e["size"]
            if (
                type(size) is not int
                or not 1 <= size <= 1024
                or type(address) is not int
                or not 0 <= address <= 65536 - size
            ):
                raise ValueError("Invalid bounded Bulk Read")
            if self.protocol == 1:
                model = next(
                    (m for m in self.catalog()["models"] if m["catalogId"] == e.get("catalogId")),
                    None,
                )
                if (
                    not model
                    or model.get("customHash")
                    or not model["catalogId"].startswith(("mx_series/", "x_series/"))
                    or "xl-320" in model["catalogId"]
                    or 1 not in model["protocols"]
                    or size > 244
                    or address + size > 256
                ):
                    raise ValueError("Protocol1 Bulk Read unsupported for this catalog/layout")
                # Verify actual model rather than trusting a caller-provided catalog ID.
                actual = int.from_bytes(bytes(self.read(e["id"], 0, 2)), "little")
                if actual not in model["modelNumbers"]:
                    raise ValueError("Bulk Read model identity mismatch")
                params.extend([size, e["id"], address])
            else:
                params.extend([e["id"], address & 255, address >> 8, size & 255, size >> 8])
            total += size
        if total > 4096:
            raise ValueError("Bulk Read response budget exceeded")
        # The pinned GroupBulkRead wrapper has an incompatible P1 signature and
        # drops status errors. Use its packet handler API and check every response.
        if self.protocol == 1:
            self.check(self.handler.bulkReadTx(self.port, params, len(params)), 0)
        else:
            self.check(self.handler.bulkReadTx(self.port, params, len(params), False), 0)
        responses = []
        for e in entries:
            data, status, error = self.handler.readRx(self.port, e["id"], e["size"])
            self.check(status, error)
            if len(data) != e["size"]:
                raise RuntimeError("Bulk Read response width mismatch")
            responses.append({"id": e["id"], "bytes": data})
        return responses

    def read(self, device_id, address, size):
        if (
            not 0 <= device_id <= (253 if self.protocol == 1 else 252)
            or not 1 <= size <= 1024
            or not 0 <= address <= 65536 - size
            or self.protocol == 1
            and address + size > 256
        ):
            raise ValueError("Invalid bounded register read")
        data, result, error = self.handler.readTxRx(self.port, device_id, address, size)
        self.check(result, error)
        if len(data) != size:
            raise RuntimeError("Unexpected register read width")
        return data

    def check(self, result, error):
        if result != 0:
            raise CommunicationError(self.handler.getTxRxResult(result), result)
        if error:
            raise DeviceStatusError("Device status error: " + self.handler.getRxPacketError(error))

    def validate_write(self, r):
        if not self.bound:
            raise ValueError("No verified source-bound configuration target")
        m, b = self.bound
        ids = [b["id"]] + b.get("peerIds", [])
        if r["id"] != b["id"]:
            raise ValueError(
                "Write must address the selected primary target; peer IDs are preconditions only"
            )
        if b.get("tableItem"):
            if r["id"] != b["id"]:
                raise ValueError(
                    "Generic item write must address the selected primary target; peer IDs are preconditions only"
                )
            return self.validate_table_write(r, m, b)
        if m.get("customHash"):
            entry = next(e for e in self.inventory()["models"] if e["catalogId"] == m["catalogId"])
            matches = [
                i
                for i in entry["items"]
                if i["address"] == r["address"] and i["width"] == len(r["data"])
            ]
            if len(matches) != 1:
                raise ValueError("Custom write address/width mismatch")
            return self.validate_table_write(r, m, {**b, "tableItem": matches[0]["key"]})
        allowed = set()
        for op, c in m["capabilities"].items():
            if c["status"] != "resolved":
                continue
            allowed.update(c.get("channels", []))
            allowed.update(c.get("registers", []))
            if c.get("register"):
                allowed.add(c["register"])
            # Legacy named grants exclude mode fields; generic items use canonical rules above.
        matches = [
            (name, reg)
            for name, reg in m["registers"].items()
            if name in allowed
            and reg["address"] == r["address"]
            and reg["width"] == len(r["data"])
            and reg["access"] == "RW"
        ]
        if len(matches) != 1 or any(not isinstance(x, int) or not 0 <= x <= 255 for x in r["data"]):
            raise ValueError("Write is not a typed named configuration capability")
        name, reg = matches[0]
        write_register = reg
        value = int.from_bytes(bytes(r["data"]), "little")
        if reg["range"] and not reg["range"][0] <= value <= reg["range"][1]:
            raise ValueError("Value outside source range")
        if name == "ID":
            entry = next(e for e in self.inventory()["models"] if e["catalogId"] == m["catalogId"])
            id_item = next(i for i in entry["items"] if i["name"] == "ID")
            maximum = id_item["write"].get("bounds", [0, 252])[1]
            if not 0 <= value <= maximum:
                raise ValueError("Invalid documented unicast ID")
        if name == "Baud Rate":
            rates = [int(k) for k, v in m["bauds"].items() if v == value]
            if len(rates) != 1 or self.port.getCFlagBaud(rates[0]) <= 0:
                raise ValueError("Destination baud unavailable in official SDK")
        if name.startswith("LED") and value > 255:
            raise ValueError("Invalid LED value")
        legacy_eeprom = any(
            p["path"].endswith("/ax/control_table.mdx") for p in m["protocolSources"]
        )
        requires_off = reg["memory"] == "EEPROM" and not legacy_eeprom
        torque = m["registers"]["Torque Enable"]
        if m["dualAxis"] and len(b.get("peerIds", [])) != 1:
            raise ValueError("Both axes must be bound")
        for device_id in ids:
            fields = {
                "Model Number": b["model"],
                "Firmware Version": b["firmware"],
                "ID": device_id,
                "Protocol Type": self.protocol,
                "Baud Rate": m["bauds"].get(str(self.port.baudrate)),
            }
            for key, expected in fields.items():
                reg = m["registers"].get(key)
                if (
                    reg
                    and not (key == "Protocol Type" and reg.get("range") == [3, 3])
                    and int.from_bytes(
                        bytes(self.read(device_id, reg["address"], reg["width"])), "little"
                    )
                    != expected
                ):
                    raise ValueError("Bound axis identity/protocol/baud changed")
            if (
                requires_off
                and int.from_bytes(
                    bytes(self.read(device_id, torque["address"], torque["width"])), "little"
                )
                != 0
            ):
                raise ValueError("Documented EEPROM write requires torque already off")
            lock = m["registers"].get("Lock")
            if (
                write_register["memory"] == "EEPROM"
                and lock
                and int.from_bytes(
                    bytes(self.read(device_id, lock["address"], lock["width"])), "little"
                )
                != 0
            ):
                raise ValueError("EEPROM Lock is active")

    def catalog(self):
        if self._catalog is None:
            self._catalog = json.loads(
                (Path(__file__).resolve().parents[2] / "references/control-tables.json").read_text(
                    encoding="utf-8"
                )
            )
            self._catalog["models"].extend(self.custom["models"])
        return self._catalog

    def inventory(self):
        if self._inventory is None:
            self._inventory = load_json(
                (Path(__file__).resolve().parents[2] / "references/control-items.json")
            )
            self._inventory["models"].extend(self.custom["itemModels"])
        return self._inventory

    def validate_table_write(self, r, m, b):
        entry = next(
            (e for e in self.inventory()["models"] if e["catalogId"] == m["catalogId"]), None
        )
        origin = (
            next((i for i in entry["items"] if i["key"] == b["tableItem"]), None) if entry else None
        )
        if not origin or origin["write"]["status"] != "resolved":
            raise ValueError("Item semantics are not source-resolved")
        items = entry["items"]
        names = {i["name"]: i for i in items}
        data = r["data"]
        item = origin
        if any(type(x) != int or not 0 <= x <= 255 for x in data):
            raise ValueError("Invalid typed item byte payload")
        mapping_evidence = {}

        def alias_at(address):
            return next(
                (
                    i
                    for i in items
                    if i["address"] == address and i["name"].startswith("Indirect Data ")
                ),
                None,
            )

        def resolve_alias(data_item, seen=None, depth=0):
            seen = set() if seen is None else set(seen)
            if depth >= 8 or data_item["key"] in seen:
                raise ValueError("Indirect cycle/traversal limit")
            seen.add(data_item["key"])
            mapping = names.get(
                "Indirect Address " + data_item["name"].removeprefix("Indirect Data ")
            )
            if not mapping or mapping["write"]["status"] != "resolved":
                raise ValueError("Indirect mapping unresolved")
            address = int.from_bytes(
                bytes(self.read(b["id"], mapping["address"], mapping["width"])), "little"
            )
            bounds = mapping["write"].get("bounds")
            if bounds and not bounds[0] <= address <= bounds[1]:
                raise ValueError("Indirect mapping outside documented domain")
            mapping_evidence[mapping["key"]] = address
            child = alias_at(address)
            if child:
                return resolve_alias(child, seen, depth + 1)
            fields = [
                i
                for i in items
                if not i["name"].startswith("Indirect Data ")
                and i["address"] <= address < i["address"] + i["width"]
            ]
            if len(fields) != 1:
                raise ValueError("Unknown/reserved/ambiguous indirect target")
            return fields[0], address - fields[0]["address"]

        if origin["write"]["kind"] == "indirect-data":
            item, offset = resolve_alias(origin)
            start = origin["address"] - offset
            if r["address"] != start or len(data) != item["width"]:
                raise ValueError("Complete indirect item frame mismatch")
            for n in range(item["width"]):
                data_item = alias_at(start + n)
                if not data_item:
                    raise ValueError("Incomplete indirect byte group")
                target, part = resolve_alias(data_item)
                if target["key"] != item["key"] or part != n:
                    raise ValueError("Nonsequential/mixed indirect target group")
            if item["name"].startswith("Indirect Address ") and item["key"] in mapping_evidence:
                raise ValueError("Self-modifying alias mapping cannot be atomic")
            expected = {v["item"]: v["value"] for v in b.get("expectedAliasMappings", [])}
            if not expected or expected != mapping_evidence:
                raise ValueError("Indirect mapping changed after confirmed intent")
        elif r["address"] != item["address"] or len(data) != item["width"]:
            raise ValueError("Typed item address/width mismatch")
        if b.get("expectedEffectiveItem") and b["expectedEffectiveItem"] != item["key"]:
            raise ValueError("Effective item changed after confirmation")
        if item["access"] not in ["RW", "R/RW"] or item["write"]["status"] != "resolved":
            raise ValueError("Indirect/direct item access is read-only or unresolved")
        rule = item["write"]
        value = int.from_bytes(bytes(data), "little", signed=rule["encoding"] == "twos-complement")
        table_scalar(rule, item, value, b["firmware"], self.protocol)

        def read(name, device_id=b["id"]):
            row = names.get(name)
            if not row or row["readStatus"] != "resolved-raw":
                raise ValueError("Required precondition item is unresolved")
            return int.from_bytes(
                bytes(self.read(device_id, row["address"], row["width"])),
                "little",
                signed=row["encoding"] == "twos-complement",
            )

        for name, expected in {
            "Model Number": b["model"],
            "Firmware Version": b["firmware"],
            "ID": b["id"],
            "Baud Rate": m["bauds"].get(str(self.port.baudrate)),
        }.items():
            if b.get("identityMode") != "ping-payload" and name in names and read(name) != expected:
                raise ValueError("Bound identity/rate changed")
        if b.get("identityMode") == "ping-payload":
            proof = raw_ping(self.handler, self.port, b["id"], self.protocol)
            if (
                self.protocol != 2
                or not proof
                or proof.get("modelNumber") != b["model"]
                or proof.get("firmwareVersion") != b["firmware"]
            ):
                raise ValueError("Protocol2 Ping identity changed before write")
        # Packet-handler identity proves active wire protocol. A conflicting Y
        # Protocol Type3 row is not substituted for transport protocol2.
        if (
            b.get("identityMode") != "ping-payload"
            and "Protocol Type" in names
            and names["Protocol Type"]["write"]["status"] != "manufacturer-unresolved"
            and read("Protocol Type") != self.protocol
        ):
            raise ValueError("Bound protocol changed")

        def peer_read(name, expected):
            if m["dualAxis"]:
                if len(b.get("peerIds", [])) != 1 or b["id"] in b["peerIds"]:
                    raise ValueError("Distinct dual-axis peer required")
                for device_id in b["peerIds"]:
                    if read(name, device_id) != expected:
                        raise ValueError("Documented peer item condition failed")

        if m["dualAxis"] and (
            origin["write"]["kind"] == "indirect-data" or item["memory"] != "EEPROM"
        ):
            shadow = next((n for n in ["Secondary ID", "Secondary(Shadow) ID"] if n in names), None)
            if shadow:
                for peer in b.get("peerIds", []):
                    if read(shadow, peer) == b["id"]:
                        raise ValueError(
                            "Known peer secondary listener would receive this one-target RAM write"
                        )
        table_live(
            rule,
            value,
            read,
            b["firmware"],
            self.protocol,
            has_item=lambda n: n in names,
            peer_read=peer_read,
        )
        if (
            rule["kind"] == "id-transition"
            and value != b["id"]
            and raw_ping(self.handler, self.port, value, self.protocol)
        ):
            raise ValueError("Destination ID already responds; no write")
        if rule["kind"] == "baud-transition":
            rates = [int(k) for k, v in m["bauds"].items() if v == value]
            if len(rates) != 1 or self.port.getCFlagBaud(rates[0]) <= 0:
                raise ValueError("Destination baud is unavailable in the official SDK")
        self._last_write_item = item

    def close(self):
        old = self.port
        self.port = None
        self.bound = None
        if old is not None and old.is_open:
            old.closePort()


def main():
    import os

    if (
        os.environ.get("CYCLO_OFFLINE") == "1"
        or os.environ.get("CYCLO_PRODUCTS_ENABLE_HARDWARE") != "1"
    ):
        raise RuntimeError(
            "Hardware bridge disabled; no serial import, discovery or port access occurred"
        )
    bridge = Bridge(sdk())
    try:
        for line in sys.stdin:
            try:
                if len(line) > 65536:
                    raise ValueError("Bridge request exceeds bound")
                request = json.loads(line)
                result = bridge.command(request)
                print(json.dumps({"ok": True, "result": result}), flush=True)
            except Exception as e:
                print(
                    json.dumps(
                        {
                            "ok": False,
                            "error": str(e),
                            "errorKind": "device-status"
                            if isinstance(e, DeviceStatusError)
                            else "no-response"
                            if isinstance(e, CommunicationError) and e.result == -3001
                            else "communication"
                            if isinstance(e, CommunicationError)
                            else "validation",
                        }
                    ),
                    flush=True,
                )
    finally:
        bridge.close()


if __name__ == "__main__":
    main()
