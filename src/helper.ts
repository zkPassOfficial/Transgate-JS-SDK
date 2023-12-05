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
