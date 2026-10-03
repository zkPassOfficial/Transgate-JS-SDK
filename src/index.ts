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
import { EventDataType, Task, TaskConfig, VerifyResult, SignatureVm } from './types';
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

    const config = await this.requestConfig();
    if (config.schemas.findIndex((schema) => schema.schema_id === schemaId) === -1) {
      throw new TransgateError(ErrorCode.ILLEGAL_SCHEMA_ID, 'Illegal schema id, please check your schema info');
    }

    const callbackUrl = config.callbackUrl || DefaultCallbackUrl;
    if (device === DeviceType.BROWSER && this.transgateAvailable) {
      const schemaInfo = await this.requestSchemaInfo(`${this.baseServer}/schema/${schemaId}`);
      const wallet = await this.prepareExtensionWallet();
      const host = schemaInfo.APIs?.[0]?.host || (schemaInfo.website ? new URL(schemaInfo.website).hostname : '');
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

    const taskInfo = await this.requestTaskInfo(config.task_rpc, config.token, schemaId, vm);
    const chainType = LegacyChainTypeByVm[vm];

    let query = `app_id=${this.appid}&task_id=${taskInfo.task}&schema_id=${schemaId}&chain_type=${chainType}&callback_url=${callbackUrl}`;

    if (address) {
      query = `${query}/&account=${address}`;
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
    } else {
      //support mobile but transgate is not available generate a qrcode
      const launchUrl = `${AppUrl.VERIFY}?${query}`;
      return await this.runWithTransgateApp(launchUrl, taskInfo.task, callbackUrl);
    }
  }

  private async runWithTransgateApp(launchUrl: string, taskId: string, callbackUrl: string) {
    try {
      const { canvasElement, remove } = insertQrcodeMask();

      await QRCode.toCanvas(canvasElement, launchUrl, {
        width: QrCodeWidth,
      });

      const closeBtn = document.getElementById(DomElementId.CLOSE);
      const zkpassCanvas = document.getElementById(DomElementId.CANVAS);

      closeBtn?.addEventListener('click', () => {
        remove();
        this.terminal = true;
      });

      this.getScanResult(taskId).then((taskUsed: unknown) => {
        if (taskUsed) {
          //@ts-ignore
          const ctx = zkpassCanvas.getContext('2d');
          ctx.filter = 'blur(5px)';
          ctx.drawImage(zkpassCanvas, 0, 0);
        }
      });

      const proof = await this.getProofInfo(taskId, callbackUrl);

      if (proof) {
        remove();
      }
      return proof;
    } catch (error) {
      if (this.terminal) {
        throw new TransgateError(ErrorCode.VERIFICATION_CANCELED, 'User terminal the validation.');
      }
      throw new TransgateError(ErrorCode.UNEXPECTED_ERROR, error);
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
    schemaInfo: any;
    taskRequestId: string;
    ephemeralAddress: string;
    address?: Address;
    vm?: SignatureVm;
  }) {
    vm = parseSignatureVm(vm);
    const extensionParams = {
      ...schemaInfo,
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
      const eventListener = (event: any) => {
        if (!event.data || event.data.id !== extensionParams.id) {
          return;
        }
        if (event.data.type === EventDataType.INVALID_SCHEMA) {
          reject(new TransgateError(ErrorCode.ILLEGAL_SCHEMA, 'Incorrect schema information.'));
        } else if (event.data.type === EventDataType.GENERATE_ZKP_SUCCESS) {
          window?.removeEventListener('message', eventListener);
          const message: VerifyResult = event.data;
          try {
            const record = message.zkpResponse?.result ?? message.result;
            const signature = message.zkpResponse?.signature ?? message.signature;
            const allocatorAddress = message.zkpResponse?.allocator ?? message.allocatorAddress;
            if (!record || record.taskId !== taskInfo.task_id || record.schemaId !== taskInfo.schema_id) {
              throw new TransgateError(ErrorCode.ILLEGAL_TASK_INFO, 'Proof does not match the allocated task.');
            }
            if (!allocatorAddress) {
              throw new TransgateError(ErrorCode.ILLEGAL_TASK_INFO, 'ZKP response did not include an allocator.');
            }
            if (
              getAddress(allocatorAddress) !== getAddress(ExtensionProofAllocator) ||
              getAddress(record.allocatorAddress) !== getAddress(ExtensionProofAllocator)
            ) {
              throw new TransgateError(
                ErrorCode.ILLEGAL_TASK_INFO,
                'Proof allocator does not match the trusted allocator.',
              );
            }
            const expectedValidator = taskInfo.validator_address || taskInfo.node_address;
            if (expectedValidator && getAddress(record.validatorAddress) !== getAddress(expectedValidator)) {
              throw new TransgateError(ErrorCode.ILLEGAL_NODE, 'Proof validator does not match the allocated node.');
            }
            if (record.vm !== vm) {
              throw new TransgateError(ErrorCode.ILLEGAL_NODE, 'Proof signature VM does not match the requested VM.');
            }
            verifyExtensionProof(signature, record);
            resolve(buildExtensionResult(message, taskInfo, record, signature));
          } catch (error) {
            reject(error instanceof TransgateError ? error : new TransgateError(ErrorCode.ILLEGAL_NODE, error));
          }
        } else if (event.data.type === EventDataType.NOT_MATCH_REQUIREMENTS) {
          window?.removeEventListener('message', eventListener);
          reject(new TransgateError(ErrorCode.NOT_MATCH_REQUIREMENTS, 'The user does not meet the requirements.'));
        } else if (event.data.type === EventDataType.ILLEGAL_WINDOW_CLOSING) {
          window?.removeEventListener('message', eventListener);
          reject(
            new TransgateError(
              ErrorCode.VERIFICATION_CANCELED,
              'The user closes the window before finishing validation.',
            ),
          );
        } else if (event.data.type === EventDataType.UNEXPECTED_VERIFY_ERROR) {
          window?.removeEventListener('message', eventListener);
          reject(
            new TransgateError(
              ErrorCode.UNEXPECTED_VERIFY_ERROR,
              'An unexpected error was encountered, please try again.',
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
          reject(new TransgateError(ErrorCode.TASK_RPC_ERROR, 'Extension did not provide an ephemeral address.'));
          return;
        }
        resolve({ taskRequestId, ephemeralAddress: event.data.ephemeralAddress });
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new TransgateError(ErrorCode.REQUEST_TIMEOUT, 'Extension task preparation timed out.'));
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

  /**
   * request task info
   * @param {*} schemaId string schema id
   * @returns
   */
  private async requestTaskInfo(taskUrl: string, token: string, schemaId: string, vm: SignatureVm): Promise<Task> {
    const response = await fetch(`https://${taskUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
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

    throw new TransgateError(ErrorCode.TASK_RPC_ERROR, 'Request task info error');
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
      throw new TransgateError(ErrorCode.TASK_RPC_ERROR, `Request extension task info error: ${response.statusText}`);
    }
    return await response.json();
  }

  private async requestConfig(): Promise<TaskConfig> {
    const response = await fetch(`${this.baseServer}/sdk/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: this.appid,
      }),
    });
    if (response.ok) {
      const result = await response.json();
      return result.info;
    }

    throw new TransgateError(ErrorCode.ILLEGAL_APPID, 'Please check your appid');
  }
  /**
   * request schema detail info
   * @param schemaUrl
   */
  private async requestSchemaInfo(schemaUrl: string) {
    const response = await fetch(schemaUrl);
    if (response.ok) {
      return await response.json();
    }
    throw new TransgateError(ErrorCode.ILLEGAL_SCHEMA_ID, 'Illegal schema url, please contact develop team!');
  }

  private async getProofInfo(taskId: string, callbackUrl: string) {
    return new Promise((resolve, reject) => {
      let loopCount = 0;
      const requestInfo = () => {
        loopCount++;
        if (loopCount > 300) {
          this.removeModal && this.removeModal();
          reject(new TransgateError(ErrorCode.REQUEST_TIMEOUT, 'Request timeout, please try again'));
          return;
        }

        if (this.terminal) {
          this.removeModal && this.removeModal();
          reject(new TransgateError(ErrorCode.VERIFICATION_CANCELED, 'User terminal the validation.'));
          return;
        }

        setTimeout(async () => {
          try {
            const response = await fetch(`${callbackUrl}?task_index=${taskId}`, { signal: AbortSignal.timeout(5000) });
            if (response.ok) {
              const res = await response.json();
              this.removeModal && this.removeModal();
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
          reject(new TransgateError(ErrorCode.REQUEST_TIMEOUT, 'Request timeout, please try again'));
          return;
        }

        if (this.terminal) {
          reject(new TransgateError(ErrorCode.VERIFICATION_CANCELED, 'User terminal the validation.'));
          return;
        }

        setTimeout(async () => {
          try {
            const response = await await fetch(ScanResultUrl, {
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
              //Task ID has been used
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
    const loading_box = document.getElementById(DomElementId.LOADING);
    loading_box?.remove();
    const complete_box = document.getElementById(DomElementId.COMPLETE);
    const verify_button = document.getElementById(DomElementId.VERIFY);
    if (complete_box) {
      complete_box.style.display = 'flex';
      verify_button?.addEventListener('click', () => {
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
