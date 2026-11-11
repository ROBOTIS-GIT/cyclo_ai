import test from 'node:test';
import assert from 'node:assert/strict';
import { withBus } from '../modules/dynamixel/bus-session.mjs';

function fixture({ openError, closeError } = {}) {
  let released = 0,
    closed = 0,
    opened = 0;
  return {
    provider: {
      connect: async () => {
        opened++;
        if (openError) throw openError;
        return {
          close: async () => {
            closed++;
            if (closeError) throw closeError;
          },
        };
      },
    },
    acquireLease: async () => ({
      port: '/MOCK',
      verify: async () => {},
      release: async () => {
        released++;
        return true;
      },
    }),
    counts: () => ({ released, closed, opened }),
  };
}

test('a pre-I/O operation error releases the lease and preserves its diagnostic', async () => {
  const f = fixture();
  await assert.rejects(
    withBus(
      f.provider,
      { port: '/MOCK' },
      async () => {
        throw Error('Invalid source condition');
      },
      f,
    ),
    /Invalid source condition/,
  );
  assert.deepEqual(f.counts(), { released: 1, closed: 0, opened: 0 });
});
test('a failed open with confirmed cleanup does not wedge subsequent calls', async () => {
  const f = fixture({ openError: Error('Port unavailable') });
  await assert.rejects(
    withBus(f.provider, { port: '/MOCK' }, async (target, connect) => connect(), f),
    /Port unavailable/,
  );
  assert.equal(f.counts().released, 1);
});
test('uncertain open or close retains ownership and cannot be reported released', async () => {
  const error = Object.assign(Error('Open cleanup failed'), { name: 'TransportClosureError' });
  const opening = fixture({ openError: error });
  await assert.rejects(
    withBus(opening.provider, { port: '/MOCK' }, async (target, connect) => connect(), opening),
    /reservation retained/,
  );
  assert.equal(opening.counts().released, 0);
  const closing = fixture({ closeError: Error('Close failed') });
  await assert.rejects(
    withBus(
      closing.provider,
      { port: '/MOCK' },
      async (target, connect) => {
        const c = await connect();
        await c.close();
      },
      closing,
    ),
    /reservation retained/,
  );
  assert.equal(closing.counts().released, 0);
});
test('successful operations close once and attach lease release evidence', async () => {
  const f = fixture();
  const result = await withBus(
    f.provider,
    { port: '/MOCK' },
    async (target, connect) => {
      const c = await connect();
      await c.close();
      await c.close();
      return { closureConfirmed: true };
    },
    f,
  );
  assert.equal(result.busReservationReleased, true);
  assert.deepEqual(f.counts(), { released: 1, closed: 1, opened: 1 });
});
