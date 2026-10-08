import { Address } from 'web3';
import QRCode from 'qrcode';

import {
  server,
  extensionId,
  DefaultCallbackUrl,
  ScanResultUrl,
  AppUrl,
  AppleAppClipMeta,
  DeviceType,
  DomElementId,
  ExtensionMessageType,
  ExtensionProofAllocator,
  ExtensionTaskUrl,
  ExtensionTaskPreparationTimeoutMs,
  LegacyChainTypeByVm,
  QrCodeWidth,
  SignatureVmValue,
  WindowMessageTargetOrigin,
} from './constants';
import { EventDataType, SchemaInfo, Task, VerifyResult, SignatureVm } from './types';
import { ErrorCode, TransgateError } from './error';
import {
  insertQrcodeMask,
  getDeviceType,
  injectMetaTag,
  launchApp,
  insertMobileDialog,
  removeMetaTag,
  launchAppForAndroid,
  isTransgateAvailable as checkExtensionAvailability,
} from './helper';
import { getAddress } from 'ethers';
import { ExtensionTask, ExtensionWallet } from './types';
import { parseSignatureVm, verifyExtensionProof } from './proofVerifier';
import { LegacyVerification } from './legacyVerifier';
import { buildExtensionResult } from './resultUtils';

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function describeHttpFailure(action: string, response: Response) {
  const status = response.statusText ? `${response.status} ${response.statusText}` : String(response.status);
  return `${action} failed with HTTP ${status}.`;
}

export default class TransgateConnect extends LegacyVerification {
  readonly appid: string;
  readonly baseServer: string;
  transgateAvailable?: boolean;
  terminal?: boolean;
  removeModal?: () => void;
  constructor(appid: string) {
    super();
    this.appid = appid;
    this.baseServer = server;
    this.terminal = false;
  }

  async launch(schemaId: string, address?: Address) {
    return await this.runTransgate({ schemaId, address, vm: SignatureVmValue.EVM });
  }

  async launchWithSolana(schemaId: string, address: string) {
    return await this.runTransgate({ schemaId, address, vm: SignatureVmValue.SVM });
  }

  async launchWithTon(schemaId: string, address: string) {
    return await this.runTransgate({ schemaId, address, vm: SignatureVmValue.TVM });
  }

  async runTransgate({
    schemaId,
    address,
    vm = SignatureVmValue.EVM,
  }: {
    schemaId: string;
    address?: Address;
    vm?: SignatureVm;
  }) {
    vm = parseSignatureVm(vm);
    this.terminal = false;
    const device = getDeviceType();

    if (device === DeviceType.IOS) {
      this.handleIOSModal();
    }

    this.transgateAvailable = await this.isTransgateAvailable();

    const schemaInfo = await this.requestSchemaInfo(schemaId);
    const callbackUrl = schemaInfo.callbackUrl || DefaultCallbackUrl;
    if (device === DeviceType.BROWSER && this.transgateAvailable) {
      const wallet = await this.prepareExtensionWallet();
      const host = schemaInfo.APIs?.[0]?.host || (schemaInfo.website ? new URL(schemaInfo.website).hostname : '');
      if (!host) {
        throw new TransgateError(
          ErrorCode.ILLEGAL_SCHEMA,
          `Schema "${schemaId}" does not define a website or API host for task allocation.`,
        );
      }
      const taskInfo = await this.requestExtensionTaskInfo(
        schemaId,
        host,
        wallet.ephemeralAddress,
        address ? String(address) : undefined,
      );
      return await this.runTransgateExtension({
        schemaId,
        address,
        taskInfo,
        schemaInfo,
        taskRequestId: wallet.taskRequestId,
        ephemeralAddress: wallet.ephemeralAddress,
        vm,
      });
    }

    const taskInfo = await this.requestTaskInfo(schemaInfo, schemaId, vm);
    const chainType = LegacyChainTypeByVm[vm];

    let query = `app_id=${this.appid}&task_id=${taskInfo.task}&schema_id=${schemaId}&chain_type=${chainType}&callback_url=${callbackUrl}`;

    if (address) {
      query = `${query}&account=${address}`;
    }
    if (device === DeviceType.ANDROID) {
      launchAppForAndroid(`${AppUrl.ANDROID_SCHEME}?${query}`, `${AppUrl.VERIFY}?${query}`);
      return await this.getProofInfo(taskInfo.task, callbackUrl);
    } else if (device === DeviceType.IOS) {
      removeMetaTag(AppleAppClipMeta.NAME);
      injectMetaTag(AppleAppClipMeta.NAME, AppleAppClipMeta.CONTENT);
      const clipUrl = `${AppUrl.APP_CLIP}&${query}`;
      this.handleIOSApp(clipUrl);
      return await this.getProofInfo(taskInfo.task, callbackUrl);
    }
    const launchUrl = `${AppUrl.VERIFY}?${query}`;
    return await this.runWithTransgateApp(launchUrl, taskInfo.task, callbackUrl);
  }

  private async runWithTransgateApp(launchUrl: string, taskId: string, callbackUrl: string) {
    try {
      const { canvasElement, remove } = insertQrcodeMask();

      await QRCode.toCanvas(canvasElement, launchUrl, {
        width: QrCodeWidth,
      });

      const closeBtn = document.getElementById(DomElementId.CLOSE);
      const zkpassCanvas = document.getElementById(DomElementId.CANVAS) as HTMLCanvasElement | null;

      closeBtn?.addEventListener('click', () => {
        remove();
        this.terminal = true;
      });

      void this.getScanResult(taskId)
        .then((taskUsed: unknown) => {
          if (taskUsed && zkpassCanvas) {
            const ctx = zkpassCanvas.getContext('2d');
            if (ctx) {
              ctx.filter = 'blur(5px)';
              ctx.drawImage(zkpassCanvas, 0, 0);
            }
          }
        })
        .catch(() => undefined);

      const proof = await this.getProofInfo(taskId, callbackUrl);

      if (proof) {
        remove();
      }
      return proof;
    } catch (error) {
      if (this.terminal) {
        throw new TransgateError(ErrorCode.VERIFICATION_CANCELED, 'Verification was canceled by the user.');
      }
      if (error instanceof TransgateError) {
        throw error;
      }
      throw new TransgateError(
        ErrorCode.UNEXPECTED_ERROR,
        `Unable to complete app-based verification: ${describeError(error)}`,
      );
    }
  }

  private async runTransgateExtension({
    schemaId,
    address,
    taskInfo,
    schemaInfo,
    taskRequestId,
    ephemeralAddress,
    vm = SignatureVmValue.EVM,
  }: {
    schemaId: string;
    taskInfo: ExtensionTask;
    schemaInfo: SchemaInfo;
    taskRequestId: string;
    ephemeralAddress: string;
    address?: Address;
    vm?: SignatureVm;
  }) {
    const extensionParams = {
      ...schemaInfo,
      id: schemaInfo.id || schemaInfo.schemaId || schemaInfo.schema_id || schemaId,
      appid: this.appid,
      task: taskInfo.task_id,
      taskInfo,
      taskRequestId,
      ephemeralAddress,
      vm,
      nodeAddress: taskInfo.node_address || taskInfo.validator_address,
      nodeHost: taskInfo.node_host || taskInfo.nodeHost || schemaInfo.node_host || schemaInfo.nodeHost,
      nodePK: taskInfo.node_pk || taskInfo.nodePK || schemaInfo.node_pk || schemaInfo.nodePK,
    };

    return new Promise((resolve, reject) => {
      const cleanup = () => window?.removeEventListener('message', eventListener);
      const eventListener = (event: any) => {
        if (!event.data || event.data.id !== extensionParams.id) {
          return;
        }
        if (event.data.type === EventDataType.INVALID_SCHEMA) {
          cleanup();
          reject(
            new TransgateError(
              ErrorCode.ILLEGAL_SCHEMA,
              `The TransGate extension rejected schema "${schemaId}" because its configuration is invalid.`,
            ),
          );
        } else if (event.data.type === EventDataType.GENERATE_ZKP_SUCCESS) {
          cleanup();
          const message: VerifyResult = event.data;
          try {
            const record = message.zkpResponse?.result ?? message.result;
            const signature = message.zkpResponse?.signature ?? message.signature;
            if (!record) {
              throw new TransgateError(
                ErrorCode.ILLEGAL_TASK_INFO,
                'The extension response does not contain a signed proof record.',
              );
            }
            if (record.taskId !== taskInfo.task_id) {
              throw new TransgateError(
                ErrorCode.ILLEGAL_TASK_INFO,
                `Proof task mismatch: expected "${taskInfo.task_id}", received "${record.taskId}".`,
              );
            }
            if (record.schemaId !== taskInfo.schema_id) {
              throw new TransgateError(
                ErrorCode.ILLEGAL_TASK_INFO,
                `Proof schema mismatch: expected "${taskInfo.schema_id}", received "${record.schemaId}".`,
              );
            }
            if (getAddress(record.allocatorAddress) !== getAddress(ExtensionProofAllocator)) {
              throw new TransgateError(
                ErrorCode.ILLEGAL_TASK_INFO,
                'The proof was not issued by the trusted allocator.',
              );
            }
            const expectedValidator = taskInfo.validator_address || taskInfo.node_address;
            if (expectedValidator && getAddress(record.validatorAddress) !== getAddress(expectedValidator)) {
              throw new TransgateError(
                ErrorCode.ILLEGAL_NODE,
                `Proof validator mismatch: expected ${expectedValidator}, received ${record.validatorAddress}.`,
              );
            }
            if (record.vm !== vm) {
              throw new TransgateError(
                ErrorCode.ILLEGAL_NODE,
                `Proof VM mismatch: requested "${vm}", received "${record.vm}".`,
              );
            }
            verifyExtensionProof(signature, record);
            resolve(buildExtensionResult(message, taskInfo, record, signature));
          } catch (error) {
            reject(
              error instanceof TransgateError
                ? error
                : new TransgateError(
                    ErrorCode.ILLEGAL_NODE,
                    `Proof signature verification failed: ${describeError(error)}`,
                  ),
            );
          }
        } else if (event.data.type === EventDataType.NOT_MATCH_REQUIREMENTS) {
          cleanup();
          reject(
            new TransgateError(
              ErrorCode.NOT_MATCH_REQUIREMENTS,
              `The submitted data does not satisfy the requirements of schema "${schemaId}".`,
            ),
          );
        } else if (event.data.type === EventDataType.ILLEGAL_WINDOW_CLOSING) {
          cleanup();
          reject(
            new TransgateError(
              ErrorCode.VERIFICATION_CANCELED,
              'Verification was canceled because the TransGate window was closed before completion.',
            ),
          );
        } else if (event.data.type === EventDataType.UNEXPECTED_VERIFY_ERROR) {
          cleanup();
          reject(
            new TransgateError(
              ErrorCode.UNEXPECTED_VERIFY_ERROR,
              'The TransGate extension could not generate the proof. Please retry the verification.',
            ),
          );
        }
      };
      window?.addEventListener('message', eventListener);
      this.launchTransgate(extensionParams, address);
    });
  }

  private launchTransgate(taskInfo: any, address?: Address) {
    window?.postMessage(
      {
        type: ExtensionMessageType.AUTH,
        mintAccount: address,
        ...taskInfo,
      },
      WindowMessageTargetOrigin,
    );
  }

  private prepareExtensionWallet(): Promise<ExtensionWallet> {
    const taskRequestId =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener('message', listener);
      };
      const listener = (event: MessageEvent) => {
        if (
          event.source !== window ||
          event.data?.type !== EventDataType.TRANSGATE_TASK_READY ||
          event.data?.taskRequestId !== taskRequestId
        ) {
          return;
        }
        cleanup();
        if (!event.data.ephemeralAddress) {
          reject(
            new TransgateError(
              ErrorCode.TASK_RPC_ERROR,
              'The TransGate extension prepared the task without returning an ephemeral wallet address.',
            ),
          );
          return;
        }
        resolve({ taskRequestId, ephemeralAddress: event.data.ephemeralAddress });
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new TransgateError(
            ErrorCode.REQUEST_TIMEOUT,
            `The TransGate extension did not prepare the task within ${
              ExtensionTaskPreparationTimeoutMs / 1000
            } seconds.`,
          ),
        );
      }, ExtensionTaskPreparationTimeoutMs);
      window.addEventListener('message', listener);
      window.postMessage(
        {
          type: ExtensionMessageType.PREPARE_TASK,
          appid: this.appid,
          taskRequestId,
        },
        WindowMessageTargetOrigin,
      );
    });
  }

  private async requestTaskInfo(schemaInfo: SchemaInfo, schemaId: string, vm: SignatureVm): Promise<Task> {
    if (!schemaInfo.task_rpc || !schemaInfo.token) {
      throw new TransgateError(
        ErrorCode.ILLEGAL_SCHEMA,
        `Schema "${schemaId}" does not include the task service configuration required for app verification.`,
      );
    }

    const response = await fetch(`https://${schemaInfo.task_rpc}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: schemaInfo.token,
        schema_id: schemaId,
        app_id: this.appid,
        chain_type: LegacyChainTypeByVm[vm],
        debug: false,
      }),
    });
    if (response.ok) {
      const result = await response.json();
      return result.info;
    }

    throw new TransgateError(
      ErrorCode.TASK_RPC_ERROR,
      describeHttpFailure(`Task allocation for schema "${schemaId}"`, response),
    );
  }

  private async requestExtensionTaskInfo(
    schemaId: string,
    host: string,
    ephemeralAddress: string,
    owner?: string,
  ): Promise<ExtensionTask> {
    const response = await fetch(ExtensionTaskUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appid,
        schema_id: schemaId,
        host,
        ephemeral_address: ephemeralAddress,
        owner,
      }),
      cache: 'no-cache',
    });
    if (!response.ok) {
      throw new TransgateError(
        ErrorCode.TASK_RPC_ERROR,
        describeHttpFailure(`Extension task allocation for schema "${schemaId}"`, response),
      );
    }
    return await response.json();
  }

  private async requestSchemaInfo(schemaId: string): Promise<SchemaInfo> {
    const response = await fetch(`${this.baseServer}/sdk/schema`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: this.appid,
        schema_id: schemaId,
      }),
    });
    if (response.ok) {
      const result = await response.json();
      return result.info || result;
    }

    throw new TransgateError(
      ErrorCode.ILLEGAL_SCHEMA_ID,
      describeHttpFailure(`Loading schema "${schemaId}" for app "${this.appid}"`, response),
    );
  }

  private async getProofInfo(taskId: string, callbackUrl: string) {
    return new Promise((resolve, reject) => {
      let loopCount = 0;
      const requestInfo = () => {
        loopCount++;
        if (loopCount > 300) {
          this.removeModal?.();
          reject(
            new TransgateError(
              ErrorCode.REQUEST_TIMEOUT,
              `Timed out waiting for proof result for task "${taskId}". Please start the verification again.`,
            ),
          );
          return;
        }

        if (this.terminal) {
          this.removeModal?.();
          reject(new TransgateError(ErrorCode.VERIFICATION_CANCELED, 'Verification was canceled by the user.'));
          return;
        }

        setTimeout(async () => {
          try {
            const response = await fetch(`${callbackUrl}?task_index=${taskId}`, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
              const res = await response.json();
              this.removeModal?.();
              resolve(res.info);
            } else {
              requestInfo();
            }
          } catch (error) {
            requestInfo();
          }
        }, 2000);
      };

      requestInfo();
    });
  }

  private async getScanResult(taskId: string) {
    return new Promise((resolve, reject) => {
      let loopCount = 0;
      const requestScanResult = () => {
        loopCount++;
        if (loopCount > 300) {
          reject(
            new TransgateError(
              ErrorCode.REQUEST_TIMEOUT,
              `Timed out waiting for task "${taskId}" to be scanned. Please start the verification again.`,
            ),
          );
          return;
        }

        if (this.terminal) {
          reject(new TransgateError(ErrorCode.VERIFICATION_CANCELED, 'Verification was canceled by the user.'));
          return;
        }

        setTimeout(async () => {
          try {
            const response = await fetch(ScanResultUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                task_id: taskId,
              }),
            });
            if (response.ok) {
              const res = await response.json();
              if (res.info.used) {
                resolve(true);
              } else {
                requestScanResult();
              }
            } else {
              requestScanResult();
            }
          } catch (error) {
            requestScanResult();
          }
        }, 1000);
      };

      requestScanResult();
    });
  }

  handleIOSModal() {
    const { remove } = insertMobileDialog();
    this.removeModal = remove;
    const closeBtn = document.getElementById(DomElementId.CLOSE);
    closeBtn?.addEventListener('click', () => {
      remove();
      this.terminal = true;
    });
  }

  handleIOSApp(clipUrl: string) {
    const loadingBox = document.getElementById(DomElementId.LOADING);
    loadingBox?.remove();
    const completeBox = document.getElementById(DomElementId.COMPLETE);
    const verifyButton = document.getElementById(DomElementId.VERIFY);
    if (completeBox) {
      completeBox.style.display = 'flex';
      verifyButton?.addEventListener('click', () => {
        launchApp(clipUrl);
      });
    }
  }

  async isTransgateAvailable() {
    const available = await checkExtensionAvailability(extensionId);
    this.transgateAvailable = available;
    return available;
  }
}
