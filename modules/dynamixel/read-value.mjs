// Decode observations without losing integer precision or assuming a write encoding.
export function readValue(bytes, encoding) {
  if (bytes.length < 1 || bytes.length > 8) return {};
  let unsigned = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) unsigned = (unsigned << 8n) | BigInt(bytes[i]);
  const bits = BigInt(bytes.length * 8);
  const signed =
    encoding === 'twos-complement' && unsigned >= 1n << (bits - 1n)
      ? unsigned - (1n << bits)
      : unsigned;
  const resolved = encoding === 'unsigned' || encoding === 'twos-complement';
  if (bytes.length <= 6)
    return { rawUnsigned: Number(unsigned), ...(resolved ? { value: Number(signed) } : {}) };
  return {
    rawUnsignedDecimal: unsigned.toString(),
    ...(resolved ? { valueDecimal: signed.toString() } : {}),
  };
}
