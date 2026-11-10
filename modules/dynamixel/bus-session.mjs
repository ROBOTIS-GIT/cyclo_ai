import { acquireBusLease } from './bus-lease.mjs';

/**
 * Run one operation under an owned bus reservation.
 * Providers must either clean up failed opens or throw TransportClosureError.
 * A successful close confirms ownership ended; a failed close retains the lease.
 */
export async function withBus(
  provider,
  target,
  work,
  { acquireLease = acquireBusLease, preflight = () => {} } = {},
) {
  const lease = await acquireLease({ port: target.port });
  let result,
    confirmed = false,
    entered = false,
    bound = false,
    active = 0,
    uncertain = false;
  const connect = async (baud, timeout, protocol) => {
    let connection;
    try {
      connection = await provider.connect(lease.port ?? target.port, baud, timeout, protocol);
    } catch (error) {
      if (error.name === 'TransportClosureError') uncertain = true;
      throw error;
    }
    active++;
    let closed = false;
    return {
      ...connection,
      close: async () => {
        if (closed) return;
        closed = true;
        try {
          await connection.close();
        } catch (error) {
          uncertain = true;
          throw error;
        } finally {
          active--;
        }
      },
    };
  };
  try {
    await lease.verify();
    if (target.verifyBinding) await target.verifyBinding();
    target.canonicalPort = lease.port ?? target.port;
    bound = true;
    await preflight(target);
    entered = true;
    result = await work(target, connect, lease.verify);
    confirmed = result.closureConfirmed === true && active === 0 && !uncertain;
    return result;
  } catch (error) {
    if (entered) {
      error.requiresReidentification = true;
      if (active || uncertain)
        error.message += '; bus reservation retained because closure could not be established';
      else confirmed = true;
    } else if (!bound) error.requiresReidentification = true;
    throw error;
  } finally {
    if (confirmed || !entered) {
      const released = await lease.release();
      if (result) result.busReservationReleased = released;
    } else if (result) result.busReservationReleased = false;
  }
}
