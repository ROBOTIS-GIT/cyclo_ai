import { encode } from '../../modules/dynamixel/registry.mjs';
export function fixture(options = {}) {
  const state = {
    id: 1,
    baud: 57600,
    model: 1200,
    firmware: 52,
    torque: 0,
    protocol: 2,
    secondaryId: 255,
    drive: 0,
    operatingMode: 3,
    velocityLimit: 445,
    ...options.state,
  };
  const calls = [],
    registers = new Map([
      [0, state.model],
      [6, state.firmware],
      [7, state.id],
      [8, 1],
      [10, state.drive],
      [11, state.operatingMode],
      [12, state.secondaryId],
      [13, state.protocol],
      [44, state.velocityLimit],
      [64, state.torque],
      [65, 0],
      [68, 2],
      [108, 0],
      [112, 0],
    ]);
  let written = 0,
    closed = false;
  const connect = async (baud, timeout, protocol = 2) => {
    calls.push(['connect', baud]);
    if (options.openFailure) throw Error('port unavailable');
    closed = false;
    return {
      ping: async (id) => {
        calls.push(['ping', id, baud]);
        if (
          protocol !== state.protocol ||
          id !== state.id ||
          baud !== state.baud ||
          (options.lostAfterWrite && written)
        )
          throw Error('packet timeout');
        return { id, modelNumber: state.model, firmwareVersion: state.firmware };
      },
      probe: async (id) => {
        calls.push(['probe', id, baud]);
        if (options.probeError) throw Error('CRC failure');
        return protocol === state.protocol &&
          (options.occupied || (id === state.id && baud === state.baud))
          ? { id, modelNumber: state.model, firmwareVersion: state.firmware }
          : null;
      },
      canBaud: async () => options.unsupportedBaud !== true,
      read: async (id, address, size) => {
        calls.push(['read', id, address, size]);
        if (options.readbackMismatch && written && address === 65) return encode(0, size);
        return encode(registers.get(address) ?? 0, size);
      },
      write: async (id, address, data) => {
        written++;
        const value = data.reduce((a, b, i) => a + b * 2 ** (8 * i), 0);
        calls.push(['write', id, address, value]);
        if (options.failBeforeApply) throw Error('write interrupted');
        registers.set(address, value);
        if (address === 7) state.id = value;
        if (address === 8)
          state.baud = [9600, 57600, 115200, 1000000, 2000000, 3000000, 4000000, 4500000][value];
        if (options.abortAfterWrite) options.abortAfterWrite();
        if (options.ackLost) throw Error('packet timeout');
      },
      close: async () => {
        calls.push(['close']);
        closed = true;
        if (options.closeFailure) throw Error('closure unconfirmed');
      },
    };
  };
  return {
    state,
    calls,
    connect,
    registers,
    get writes() {
      return calls.filter((c) => c[0] === 'write');
    },
    provider: {
      ports: async () => [{ path: '/MOCK-ONLY' }],
      connect: async (port, baud) => connect(baud),
    },
  };
}
