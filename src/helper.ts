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

export function getObjectValues(json: any) {
  let values: any = [];

  function recurse(obj: any) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          recurse(obj[key]); // it's a nested object, so we do it again
        } else {
          values.push(obj[key]); // it's not an object, so we just push the value
        }
      }
    }
  }

  recurse(json);
  return values.join('');
}
