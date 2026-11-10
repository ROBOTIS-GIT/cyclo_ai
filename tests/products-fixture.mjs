// Test entrypoint only: dependency-injected in-memory provider, no SDK import.
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createProductsServer } from '../modules/dynamixel/server.mjs';
import { fixture } from './fixtures/device.mjs';
const scenario = process.env.CYCLO_TEST_SCENARIO;
const f = fixture(
  scenario === 'lost-write'
    ? { lostAfterWrite: true }
    : scenario === 'occupied'
      ? { occupied: true }
      : scenario === 'unsupported'
        ? { state: { model: 999 } }
        : {},
);
const connect = f.provider.connect;
f.provider.connect = async (port, baud, timeout, protocol) => {
  const c = await connect(port, baud, timeout, protocol);
  if (scenario === 'none') c.probe = async () => null;
  if (scenario === 'multiple') {
    const probe = c.probe;
    c.probe = async (id) =>
      id === 2 && baud === 57600 ? { id, modelNumber: 1200, firmwareVersion: 52 } : probe(id);
  }
  return c;
};
await serveStdio(() =>
  createProductsServer(process.env, {
    provider: f.provider,
    lease: async () => ({ port: '/MOCK-ONLY', verify: async () => {}, release: async () => true }),
  }),
);
