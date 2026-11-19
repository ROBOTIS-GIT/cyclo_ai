"""Group transactions through the real SDK using an in-memory multi-device bus."""

import unittest
from test_sdk_packets import bridge, api
from table_packet_fixture import fixture


class GroupPackets(unittest.TestCase):
    def bus(self, catalogs, protocol=2):
        devices = [fixture(c, protocol=protocol) for c in catalogs]
        for n, f in enumerate(devices, 1):
            f["state"]["id"] = n
            f["put"]("ID", n)
        frames = []
        state = {"fail_tx": False, "mismatch": False, "close_fail": False}

        class Bus(devices[0]["Port"]):
            def __init__(self, name):
                super().__init__(name)
                self.children = [f["Port"](name) for f in devices]

            def writePort(self, packet):
                frames.append(list(packet))
                wire = (
                    list(packet)
                    if protocol == 1
                    else api.Protocol2PacketHandler().removeStuffing(list(packet))
                )
                device_id = wire[2 if protocol == 1 else 4]
                instruction = wire[4 if protocol == 1 else 7]
                params = wire[5:-1] if protocol == 1 else wire[8:-2]
                if device_id != 254:
                    if 1 <= device_id <= len(self.children):
                        child = self.children[device_id - 1]
                        child.baudrate = self.baudrate
                        child.writePort(wire)
                        self.buffer = child.buffer
                    return len(packet)
                if instruction in [0x83, 0x93]:
                    if state["fail_tx"]:
                        raise RuntimeError("simulated partial transmission")
                    if instruction == 0x83:
                        address = params[0] if protocol == 1 else params[0] | params[1] << 8
                        size = params[1] if protocol == 1 else params[2] | params[3] << 8
                        offset = 2 if protocol == 1 else 4
                    else:
                        offset = 0
                    while offset < len(params):
                        i = params[offset]
                        offset += 1
                        if instruction == 0x93:
                            address = params[offset] | params[offset + 1] << 8
                            size = params[offset + 2] | params[offset + 3] << 8
                            offset += 4
                        if not state["mismatch"] or i != len(devices):
                            for n, value in enumerate(params[offset : offset + size]):
                                devices[i - 1]["state"]["memory"][address + n] = value
                        offset += size
                    return len(packet)
                if instruction == 0x92:
                    entries = []
                    if protocol == 1:
                        for off in range(1, len(params), 3):
                            size, i, address = params[off : off + 3]
                            entries.append((i, address, size))
                    else:
                        for off in range(0, len(params), 5):
                            i, a, b, c, d = params[off : off + 5]
                            entries.append((i, a | b << 8, c | d << 8))
                    self.buffer = []
                    for i, address, size in entries:
                        data = [
                            devices[i - 1]["state"]["memory"].get(address + n, 0)
                            for n in range(size)
                        ]
                        if protocol == 1:
                            response = [255, 255, i, len(data) + 2, 0] + data
                            response.append((~sum(response[2:])) & 255)
                        else:
                            response = (
                                [255, 255, 253, 0, i, len(data) + 4, 0, 85, 0] + data + [0, 0]
                            )
                            crc = api.Protocol2PacketHandler().updateCRC(
                                0, response, len(response) - 2
                            )
                            response[-2:] = [crc & 255, crc >> 8]
                        self.buffer.extend(response)
                    return len(packet)
                raise AssertionError("Unexpected broadcast opcode")

        old = api.PortHandler
        api.PortHandler = Bus
        self.addCleanup(setattr, api, "PortHandler", old)
        b = bridge.Bridge(api)
        b.command(dict(op="open", port="/MOCK-GROUP", baud=57600, timeoutMs=30, protocol=protocol))
        self.addCleanup(b.close)
        return b, devices, frames, state

    def request(self, devices, item="LED", values=None, instruction="syncWrite"):
        return dict(
            op="writeGroup",
            instruction=instruction,
            entries=[
                dict(
                    id=n,
                    catalogId=f["model"]["catalogId"],
                    model=f["model"]["modelNumbers"][0],
                    firmware=52,
                    tableItem=f["names"][item]["key"],
                    value=values[n - 1] if values else 1,
                    peerIds=[],
                )
                for n, f in enumerate(devices, 1)
            ],
        )

    def group_frames(self, frames, protocol):
        return [p for p in frames if p[4 if protocol == 1 else 7] in [0x83, 0x93]]

    def test_sync_write_both_protocols_uses_one_packet_and_verifies_every_target(self):
        for protocol, catalog in [(1, "ax_series/ax-12a"), (2, "x_series/xm_series/xm430-w350")]:
            with self.subTest(protocol=protocol):
                b, devices, frames, _ = self.bus([catalog] * 3, protocol)
                result = b.command(self.request(devices))
                self.assertEqual(result["outcome"], "verified", result)
                packets = self.group_frames(frames, protocol)
                self.assertEqual(len(packets), 1)
                self.assertEqual(len(packets[0]), result["packetBytes"])
                self.assertEqual([f["get"]("LED") for f in devices], [1, 1, 1])

    def test_protocol2_stuffing_updates_the_actual_wire_buffer(self):
        b, devices, frames, _ = self.bus(["x_series/xm_series/xm430-w350"] * 2)
        # Exercise the exact pinned SDK path, including reserved header bytes.
        group = api.GroupSyncWrite(b.port, b.handler, 116, 4)
        group.addParam(1, [255, 255, 253, 0])
        group.addParam(2, [0, 0, 0, 0])
        self.assertEqual(group.txPacket(), 0)
        packet = self.group_frames(frames, 2)[0]
        self.assertEqual(packet[13:17], [255, 255, 253, 253])
        self.assertEqual(len(packet), (packet[5] | packet[6] << 8) + 7)
        self.assertEqual(
            packet[-2] | packet[-1] << 8, b.handler.updateCRC(0, packet, len(packet) - 2)
        )

    def test_bulk_write_mixed_layout(self):
        b, devices, frames, _ = self.bus(
            ["x_series/xm_series/xm430-w350", "x_series/xl_series/xl320"]
        )
        result = b.command(self.request(devices, instruction="bulkWrite"))
        self.assertEqual(result["outcome"], "verified", result)
        self.assertEqual(self.group_frames(frames, 2)[0][7], 0x93)

    def test_invalid_last_target_prevents_all_group_writes(self):
        for change in ["value", "identity", "kind"]:
            with self.subTest(change=change):
                b, devices, frames, _ = self.bus(["x_series/xm_series/xm430-w350"] * 3)
                r = self.request(devices)
                if change == "value":
                    r["entries"][-1]["value"] = 999
                elif change == "identity":
                    r["entries"][-1]["model"] = 999
                else:
                    r["entries"][-1]["tableItem"] = devices[-1]["names"]["ID"]["key"]
                result = b.command(r)
                self.assertEqual(result["outcome"], "not_written", result)
                self.assertFalse(result["transmission"]["attempted"])
                self.assertEqual(self.group_frames(frames, 2), [])

    def test_last_target_live_limit_failure_prevents_the_entire_group(self):
        b, devices, frames, _ = self.bus(["x_series/xm_series/xm430-w350"] * 3)
        devices[-1]["put"]("Max Position Limit", 500)
        result = b.command(self.request(devices, item="Goal Position", values=[1024] * 3))
        self.assertEqual(result["outcome"], "not_written", result)
        self.assertFalse(result["transmission"]["attempted"])
        self.assertEqual(self.group_frames(frames, 2), [])

    def test_transmission_failure_or_readback_mismatch_never_retries(self):
        for key in ["fail_tx", "mismatch"]:
            b, devices, frames, state = self.bus(["x_series/xm_series/xm430-w350"] * 3)
            state[key] = True
            result = b.command(self.request(devices))
            self.assertEqual(result["outcome"], "uncertain", result)
            self.assertEqual(len(self.group_frames(frames, 2)), 1)

    def test_bulk_reads_use_real_packets_in_both_protocols(self):
        for protocol, catalog in [(1, "mx_series/mx-28"), (2, "x_series/xm_series/xm430-w350")]:
            b, devices, frames, _ = self.bus([catalog] * 3, protocol)
            entries = [
                dict(
                    id=n,
                    catalogId=f["model"]["catalogId"],
                    address=f["names"]["LED"]["address"],
                    size=1,
                )
                for n, f in enumerate(devices, 1)
            ]
            result = b.command(dict(op="bulkRead", entries=entries))
            self.assertEqual([r["id"] for r in result], [1, 2, 3])
            self.assertEqual(sum(p[4 if protocol == 1 else 7] == 0x92 for p in frames), 1)


if __name__ == "__main__":
    unittest.main()
