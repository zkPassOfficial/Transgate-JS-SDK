import Web3 from 'web3';
import { transgateWrapper, mobileDialog } from './transgateWrapper';

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

export function getDeviceType() {
  const userAgent = navigator.userAgent || navigator.vendor;

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'iOS';
  } else if (/Android/i.test(userAgent)) {
    return 'Android';
  } else {
    return 'Browser'; //default to browser
  }
}

export function insertMobileDialog() {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '9999';

  document.getElementsByTagName('body')[0].appendChild(modal);
  modal.innerHTML = mobileDialog;

  return { remove: () => modal.remove() };
}

export function insertQrcodeMask() {
  //create a modal to show the qrcode
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '9999';

  document.getElementsByTagName('body')[0].appendChild(modal);

  modal.innerHTML = transgateWrapper;

  const canvasElement = document.getElementById('zkpass-canvas');

  if (!canvasElement) {
    modal.remove();
    throw new Error('generate qrcode failed');
  }

  return { canvasElement, remove: () => modal.remove() };
}

export function launchApp(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function injectMetaTag(name: string, content: string) {
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.getElementsByTagName('head')[0].appendChild(meta);
}

export function removeMetaTag(name: string) {
  const metaCollection = Array.from(document.getElementsByTagName('meta')) || [];

  for (const meta of metaCollection) {
    if (meta.name == name) {
      meta.remove();
    }
  }
}

function isSafari() {
  return (
    navigator.vendor === 'Apple Computer, Inc.' &&
    navigator.userAgent.includes('Safari') &&
    !navigator.userAgent.includes('CriOS') &&
    !navigator.userAgent.includes('FxiOS')
  );
}

export async function isTransgateAvailable(extensionId: string) {
  try {
    const url = `chrome-extension://${extensionId}/images/icon-16.png`;
    const { statusText } = await fetch(url);
    if (statusText === 'OK') {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

export function genPublicFieldHash(publicFields = []) {
  const publicData = publicFields.map((item: any) => {
    delete item.str;
    return item;
  });

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

  recurse(publicData);
  const publicFieldStr = values.join('');

  return Web3.utils.soliditySha3(
    !!publicFieldStr ? Web3.utils.stringToHex(publicFieldStr) : Web3.utils.utf8ToHex('1'),
  ) as string;
}
