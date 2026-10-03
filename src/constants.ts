import type { SignatureVm } from './types';

export const server = 'https://dev.zkpass.org/v1';

export const extensionId = 'afkoofjocpbclhnldmmaphappihehpma';

export const SolanaTaskAllocator = '69e7d686e612ab57e3619f4a19a567b3b212a5b35ba0e3b600fbed5c2ee9083d';
export const EVMTaskAllocator = '0x19a567b3b212a5b35bA0E3B600FbEd5c2eE9083d';

export const TonTaskPubKey = '6ab539926d899a69385d8c5a35bd8c3e650dbd0a0c5e3e9a3cca15867e11d884';

export const DefaultCallbackUrl = `${server}/relay/proof`;

export const ScanResultUrl = `${server}/sdk/taskstate`;

export const ExtensionTaskUrl = 'https://task.zkpass.org/task/new';

export const ExtensionProofAllocator = '0xdDFAde79D5e34EF3d5a07c4Ad89Df6fecB40db7A';

export const SignatureVmValue = {
  EVM: 'evm',
  SVM: 'svm',
  TVM: 'tvm',
} as const;

export const SupportedSignatureVms: readonly SignatureVm[] = Object.values(SignatureVmValue);

export const LegacyChainTypeByVm: Record<SignatureVm, 'evm' | 'sol' | 'ton'> = {
  [SignatureVmValue.EVM]: 'evm',
  [SignatureVmValue.SVM]: 'sol',
  [SignatureVmValue.TVM]: 'ton',
};

export const DeviceType = {
  IOS: 'iOS',
  ANDROID: 'Android',
  BROWSER: 'Browser',
} as const;

export const ExtensionMessageType = {
  AUTH: 'AUTH_ZKPASS',
  PREPARE_TASK: 'PREPARE_ZKPASS_TASK',
} as const;

export const AppUrl = {
  VERIFY: 'https://app.zkpass.org/verify',
  ANDROID_SCHEME: 'zkpass://zkpass.com/verify',
  APP_CLIP: 'https://appclip.apple.com/id?p=com.zkpass.transgate.clip',
} as const;

export const DownloadUrl = {
  IOS: 'https://apps.apple.com/us/app/transgate/id1561374855',
  ANDROID: 'https://play.google.com/store/apps/details?id=com.zkpass.transgate',
  EXTENSION: `https://chromewebstore.google.com/detail/zkpass-transgate/${extensionId}`,
} as const;

export const AppleAppClipMeta = {
  NAME: 'apple-itunes-app',
  CONTENT: 'app-clip-bundle-id=com.zkpass.transgate.clip, app-id=6738957441 app-clip-display=card',
} as const;

export const DomElementId = {
  CLOSE: 'close-transgate',
  CANVAS: 'zkpass-canvas',
  LOADING: 'loading-box',
  COMPLETE: 'complete-box',
  VERIFY: 'verify-button',
} as const;

export const ExtensionTaskPreparationTimeoutMs = 10_000;
export const AndroidAppFallbackTimeoutMs = 1_500;
export const QrCodeWidth = 240;
export const WindowMessageTargetOrigin = '*';
