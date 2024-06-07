/**
 * parse signature to v, r, s
 * @param signature
 * @returns
 */
export const parseSignature = (signature: string) => {
  signature = signature.slice(2);
  return {
    v: parseInt('0x' + signature.slice(128, 130), 16),
    r: '0x' + signature.slice(0, 64),
    s: '0x' + signature.slice(64, 128),
  };
};

export const hexToBytes = (hex: string) => {
  const bytes = [];
  for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substring(c, c + 2), 16));
  return new Uint8Array(bytes);
};
