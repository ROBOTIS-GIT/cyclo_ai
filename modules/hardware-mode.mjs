// Availability never starts discovery, opens a port or authorizes an operation.
export function hardwareEnabled(env = process.env, legacyFlag) {
  return env.CYCLO_OFFLINE !== '1' && env[legacyFlag] !== '0';
}
export function requireConfirmation(confirmed) {
  if (confirmed !== true) throw Error('Explicit per-operation user confirmation is required; no hardware access occurred');
}
