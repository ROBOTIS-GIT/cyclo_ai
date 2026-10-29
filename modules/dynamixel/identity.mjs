import { candidatesFor, decode } from './registry.mjs';
// Presence and identity are separate. A failed identity READ never erases a Ping.
export async function identify(
  connection,
  id,
  protocol,
  { probe = false, allowPingOnly = false, catalogId } = {},
) {
  const ping = await connection[probe ? 'probe' : 'ping'](id);
  if (!ping) return null;
  const result = { ...ping, id, protocol, present: true, identityComplete: false };
  try {
    if (ping.statusError) throw Error('Device status error: ' + ping.statusError);
    if (ping.id !== id) throw Error('Unexpected responder ID');
    const number = ping.modelNumber ?? decode(await connection.read(id, 0, 2));
    result.modelNumber = number;
    const candidates = candidatesFor(number, protocol).filter(
      (m) =>
        (!catalogId || m.catalogId === catalogId) &&
        (!m.customFirmwares ||
          ping.firmwareVersion === undefined ||
          m.customFirmwares.includes(ping.firmwareVersion)),
    );
    result.catalogCandidates = candidates.map((m) => m.catalogId);
    if (!candidates.length)
      throw Error('Unknown model/protocol identity; no firmware address is guessed');
    const firmwareFields = new Set(
      candidates.map((m) =>
        JSON.stringify([
          m.registers['Firmware Version'].address,
          m.registers['Firmware Version'].width,
        ]),
      ),
    );
    if (firmwareFields.size !== 1)
      throw Error(
        'Ambiguous firmware-register identity; select exact catalog before further reads',
      );
    const [address, width] = JSON.parse([...firmwareFields][0]);
    result.firmwareVersion = decode(await connection.read(id, address, width));
    if (result.firmwareVersion > 255) throw Error('Unknown firmware byte');
    if (ping.firmwareVersion !== undefined && ping.firmwareVersion !== result.firmwareVersion)
      throw Error('Ping and control-table firmware mismatch');
    if (
      !candidates.some(
        (m) => !m.customFirmwares || m.customFirmwares.includes(result.firmwareVersion),
      )
    )
      throw Error('Firmware outside reviewed custom contract');
    result.identityComplete = true;
    return result;
  } catch (e) {
    if (
      allowPingOnly &&
      protocol === 2 &&
      e.kind === 'no-response' &&
      Number.isInteger(ping.modelNumber) &&
      Number.isInteger(ping.firmwareVersion) &&
      ping.firmwareVersion >= 0 &&
      ping.firmwareVersion <= 255 &&
      result.catalogCandidates?.length
    ) {
      return {
        ...result,
        firmwareVersion: ping.firmwareVersion,
        identityComplete: true,
        identityProof: 'Protocol2 Ping model/firmware payload',
        readbackUnavailable: true,
        identityReadError: e.message,
      };
    }
    return { ...result, identityError: e.message };
  }
}
