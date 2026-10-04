import Web3 from 'web3';
import { transgateWrapper, mobileDialog } from './transgateWrapper';
import { AndroidAppFallbackTimeoutMs, DeviceType, DomElementId } from './constants';

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
  const values: unknown[] = [];

  function recurse(obj: any) {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        recurse(obj[key]);
      } else {
        values.push(obj[key]);
      }
    }
  }

  recurse(json);
  return values.join('');
}

export function getDeviceType() {
  const userAgent = navigator.userAgent || navigator.vendor;

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return DeviceType.IOS;
  } else if (/Android/i.test(userAgent)) {
    return DeviceType.ANDROID;
  }
  return DeviceType.BROWSER;
}

function createOverlay(content: string) {
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
  modal.style.pointerEvents = 'auto';

  modal.innerHTML = content;
  document.body.appendChild(modal);

  return modal;
}

export function insertMobileDialog() {
  const modal = createOverlay(mobileDialog);
  return { remove: () => modal.remove() };
}

export function insertQrcodeMask() {
  const modal = createOverlay(transgateWrapper);
  const canvasElement = document.getElementById(DomElementId.CANVAS) as HTMLCanvasElement | null;

  if (!canvasElement) {
    modal.remove();
    throw new Error('Unable to display the verification QR code because its canvas element is missing.');
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
    if (meta.name === name) {
      meta.remove();
    }
  }
}

export async function isTransgateAvailable(extensionId: string) {
  try {
    const url = `chrome-extension://${extensionId}/images/icon-16.png`;
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

export function launchAppForAndroid(url: string, backupUrl: string) {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);

  const fallbackTimeout = setTimeout(() => {
    iframe.remove();
    window.location.href = backupUrl;
  }, AndroidAppFallbackTimeoutMs);

  window.addEventListener(
    'blur',
    () => {
      clearTimeout(fallbackTimeout);
      iframe.remove();
    },
    { once: true },
  );
}

export function genPublicFieldHash(publicFields = []) {
  const publicData = publicFields.map((item: any) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return item;
    }
    const { str, ...field } = item;
    return field;
  });
  const publicFieldStr = getObjectValues(publicData);

  return Web3.utils.soliditySha3(
    !!publicFieldStr ? Web3.utils.stringToHex(publicFieldStr) : Web3.utils.utf8ToHex('1'),
  ) as string;
}

export function textToUnicodeSmart(str: string) {
  return Array.from(str)
    .map((ch) => {
      const code = ch.codePointAt(0);
      if (code! <= 0x7f) {
        return ch;
      }
      return '\\u' + code?.toString(16).padStart(4, '0');
    })
    .join('');
}
