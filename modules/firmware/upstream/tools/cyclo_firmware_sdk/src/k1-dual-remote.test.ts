import assert from "node:assert/strict";
import { readK1DualRemoteStatus } from "./devices/k1-dual-remote.js";
import { getControlTableSchemaForDevice } from "./devices/registry.js";
import { K1_HAT_C5_REV06_CONTROL_TABLE_SCHEMA as schema,
  K1_HAT_C5_REV06_FW41_CONTROL_TABLE_SCHEMA as fw41,
  K1_HAT_C5_REV06_FW36_CONTROL_TABLE_SCHEMA as previous } from "./generated/k1-hat-c5-rev06-control-table.js";
import type { ControlTableSnapshot } from "./control-table.js";

const now = 10000;
const snapshot: ControlTableSnapshot = {};
for (const item of schema.items.filter(item => item.address >= 1600))
  snapshot[String(item.address)] = { item, raw: new Uint8Array(item.length), rawHex: "",
    value: item.init ?? 0, display: "", updatedAt: now };
const set = (address: number, value: number) => { snapshot[String(address)].value = value; };
const read = (connected = true, time = now) => readK1DualRemoteStatus(snapshot, 39, connected, time);
for (const fw of [35, 36, 37, 38]) {
  const ambiguous = getControlTableSchemaForDevice(5105, fw);
  assert.equal(ambiguous?.name, "K1 HAT C5 (revision unverified)");
  assert.deepEqual(ambiguous?.items, previous.items);
  assert(!ambiguous?.items.some(item => item.address >= 1600));
}
assert.equal(getControlTableSchemaForDevice(5105, 39), fw41);
assert.equal(getControlTableSchemaForDevice(5105, 41), fw41);
assert.equal(getControlTableSchemaForDevice(5105, 43), schema);
assert(!previous.items.some(item => item.address >= 1600));
for (const item of previous.items) {
  const current = fw41.items.find(other => other.address === item.address);
  assert(current);
  assert.deepEqual({ ...current, init: item.init }, item);
}
for (const item of schema.items.filter(item => item.address >= 1600))
  assert.equal(item.access, item.address === 1856 ? "rw" : "r");
assert.equal(readK1DualRemoteStatus(snapshot, 36, true, now).supported, false);
assert(read().rawOnly && read().controlFresh);
assert.equal(read().remote2Config?.requested, false);
set(1632, 7); set(1634, 1);
set(1728, 7); set(1730, 1);
assert.equal(read().remotes[0].linkState, "Connected");
assert.equal(read().remotes[1].linkState, "Disabled");
assert(!read().remotes[1].valid);
set(1856, 1); set(1859, 2); set(1861, 1);
assert(!read().remote2Config?.canReboot);
set(1859, 1); set(1860, 1);
assert(read().remote2Config?.canReboot);
set(1857, 1); set(1858, 2);
assert.equal(read().remotes[1].linkState, "Initialization failed");
assert.equal(readK1DualRemoteStatus(snapshot, 40, true, now).remotes[1].linkState, "Unavailable");
set(1858, 1); set(1861, 0);
assert.equal(read().remotes[1].linkState, "Connected");
for (let channel = 0; channel < 16; channel++) set(1764 + channel * 2, 1000 + channel * 60);
assert.deepEqual(read().remotes[1].channels, Array.from({ length: 16 }, (_, i) => 1000 + i * 60));
assert.equal(read().groupEnabled, null);
assert.equal(read().ledHint, null);
set(1608, 3);
assert.deepEqual(read().stopSources, ["Physical", "Remote 1"]);
set(1730, 101);
assert.equal(read().remotes[1].linkState, "Failsafe");
set(1730, 1); set(1856, 0); set(1861, 1); set(1859, 2);
assert.equal(read().remotes[1].linkState, "Connected");
assert(!read().remote2Config?.canReboot);
set(1859, 3);
assert(!read().remote2Config?.canReboot);
assert.equal(read(false).remote2Config?.requested, null);
assert(!read(true, now + 1501).remotes[1].valid);
snapshot["1858"].updatedAt = now - 1501;
assert.equal(read().remotes[1].linkState, "Stale");
assert(read().remotes[0].valid);
snapshot["1858"].updatedAt = now;
for (const address of [1730, 1732, 1764, 1794, 1808]) {
  snapshot[String(address)].updatedAt = now - 1;
  assert.equal(read().remotes[1].linkState, "Stale");
  assert(!read().remotes[1].valid);
  assert(read().remotes[0].valid);
  snapshot[String(address)].updatedAt = now;
}
delete snapshot["1808"];
assert.equal(read().remotes[1].linkState, "Stale");
set(1632, 31); set(1656, 1); set(1658, 75); set(1660, 99);
assert.equal(read().remotes[0].linkQuality, 99);
for (const address of [1656, 1658, 1660, 1667]) {
  snapshot[String(address)].updatedAt = now - 5000;
  assert(read().remotes[0].valid);
  assert.equal(read().remotes[0].linkQuality, null);
  assert.equal(read().remotes[0].rssi1, null);
  snapshot[String(address)].updatedAt = now;
}
set(1656, 1001);
assert.equal(read().remotes[0].linkQuality, null);
set(1600, 1);
assert(!read().controlFresh && !read().remotes[0].valid);
console.log("REV06 Remote ABI2, FW36 compatibility, boot-applied settings and freshness tests passed");
