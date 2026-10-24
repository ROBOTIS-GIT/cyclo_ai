// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { mkdir, lstat, stat, realpath, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';

async function busKeys(target) {
  const keys = [];
  let pinnedPort, pinnedInfo;
  if (target.port) {
    try {
      const canonical = await realpath(target.port);
      const info = await stat(canonical, {bigint:true});
      if (target.selectedAlias && await realpath(target.selectedAlias) !== canonical) throw new Error('Selected serial alias changed after discovery');
      if (target.dynamic && !info.isCharacterDevice()) throw new Error('Selected path is no longer a serial character device');
      if (target.selection && ['dev','ino','rdev','ctimeNs'].some(key => String(info[key]) !== target.selection[key])) throw new Error('Selected serial device changed after discovery; refresh serial-ports');
      pinnedPort = canonical; pinnedInfo = info;
      keys.push('serial-path:' + canonical);
      keys.push(info.isCharacterDevice() ? 'serial-device:' + info.rdev : 'serial-inode:' + info.dev + ':' + info.ino);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      throw new Error('Configured serial port is absent; no command was launched');
    }
  } else {
    // Conservatively own the whole configured network host, across protocols/routes.
    keys.push('network-host:' + target.host.toLowerCase());
  }
  // A trusted host can group DNS aliases or multiple bridges onto the same bus.
  // This supplements the physical key and cannot override alias protection.
  if (target.busId) keys.push('operator-bus:' + target.busId);
  return { keys: [...new Set(keys)].sort(), pinnedPort, pinnedInfo };
}

/** Cooperative host reservation, held across child closure and baud reconnects.
 * Stale leases fail closed: a dead MCP parent may leave a live CLI child.
 * Never reclaim by PID/liveness guesses. Host cleanup requires exclusivity.
 */
export async function acquireBusLease(target) {
  const directory = join('/tmp', 'cyclo-firmware-mcp-' + (process.getuid?.() ?? 'user'));
  await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  const directoryInfo = await lstat(directory);
  if (!directoryInfo.isDirectory() || (process.getuid && directoryInfo.uid !== process.getuid()) || (directoryInfo.mode & 0o077)) throw new Error('Unsafe host bus reservation directory; operator must correct it');
  const held = [];
  const release = async () => {
    let released = true;
    for (const lease of held.reverse()) {
      try {
        await lease.handle.close();
        const current = await lstat(lease.path).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
        if (current && current.dev === lease.info.dev && current.ino === lease.info.ino) await unlink(lease.path);
        else if (current) released = false; // Never unlink somebody else's replacement.
      } catch { released = false; } // Keep reservation on cleanup failure.
    }
    return released;
  };
  try {
    const binding = await busKeys(target);
    for (const key of binding.keys) {
      const path = join(directory, createHash('sha256').update(key).digest('hex') + '.lease');
      let handle;
      try { handle = await open(path, 'wx', 0o600); }
      catch (error) {
        if (error.code === 'EEXIST') throw new Error('A hardware operation is already in progress on this bus, or a stale host reservation requires operator cleanup after confirming all owners have exited');
        throw error;
      }
      const info = await handle.stat();
      held.push({ path, handle, info });
      await handle.writeFile(JSON.stringify({ pid: process.pid, key }) + '\n');
    }
    return {
      release,
      port: binding.pinnedPort,
      verify: async () => {
        if (!binding.pinnedPort) return;
        if (target.selectedAlias && await realpath(target.selectedAlias) !== binding.pinnedPort) throw new Error('Selected serial alias changed before execution');
        const current = await stat(binding.pinnedPort, {bigint:true});
        if (current.dev !== binding.pinnedInfo.dev || current.ino !== binding.pinnedInfo.ino || current.rdev !== binding.pinnedInfo.rdev || current.ctimeNs !== binding.pinnedInfo.ctimeNs) throw new Error('Configured physical serial binding changed before execution; no command was launched');
      },
    };
  } catch (error) { await release(); throw error; }
}
