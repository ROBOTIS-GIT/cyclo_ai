// SPDX-License-Identifier: Apache-2.0
import { access, realpath, stat, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { NodeSerialTransport, type NodeSerialPortInfo } from './node-serial-transport.js';

/** OS enumeration only: never opens a port or changes permissions. */
export async function listSerialPorts(list: () => Promise<NodeSerialPortInfo[]> = () => NodeSerialTransport.listPorts()) {
  const aliases = await readdir('/dev/serial/by-id').catch(() => []);
  return Promise.all((await list()).map(async info => {
    const canonicalPath = await realpath(info.path).catch(() => info.path);
    const stablePaths: string[] = [];
    for (const name of aliases) {
      const path = '/dev/serial/by-id/' + name;
      if (await realpath(path).catch(() => '') === canonicalPath) stablePaths.push(path);
    }
    const permission = await access(canonicalPath, constants.R_OK | constants.W_OK).then(() => 'read_write' as const, () => 'unavailable' as const);
    return { ...info, canonicalPath, stablePaths, permission, transports: ['vcp', 'uart-rs485'], hint: permission === 'read_write' ? 'OS permissions permit access; exclusive ownership and successful open are still required.' : 'Unavailable or permission denied; use the OS operator to resolve access. Permissions are never changed automatically.' };
  }));
}

/** Accept listed OS serial devices and their aliases, never arbitrary files. */
export async function resolveSerialPort(path: string, list: () => Promise<NodeSerialPortInfo[]> = () => NodeSerialTransport.listPorts()) {
  if (!path.startsWith('/') || path.includes('\0')) throw new Error('Select an absolute OS serial device path from serial-ports');
  const canonicalPath = await realpath(path).catch(() => { throw new Error('Serial port is absent or cannot be resolved; refresh serial-ports'); });
  const ports = await listSerialPorts(list);
  const port = ports.find(info => info.canonicalPath === canonicalPath);
  const info = await stat(canonicalPath, {bigint:true});
  if (!port || !canonicalPath.startsWith('/dev/') || !info.isCharacterDevice()) throw new Error('Selected path is not an OS-enumerated serial device');
  if (port.permission !== 'read_write') throw new Error('Serial device permission denied or unavailable; OS permissions must be resolved by the operator');
  return {...port,binding:{dev:String(info.dev),ino:String(info.ino),rdev:String(info.rdev),ctimeNs:String(info.ctimeNs)}};
}
