import Web3, { Address } from 'web3';
import { Buffer } from 'buffer';
import secp256k1 from 'secp256k1';
import * as borsh from 'borsh';
import sha3 from 'js-sha3';
import { Address as TonAddress, beginCell } from '@ton/ton';
import QRCode from 'qrcode';

import {
  server,
  extensionId,
  SolanaTaskAllocator,
  EVMTaskAllocator,
  TonTaskPubKey,
  DefaultCallbackUrl,
  ScanResultUrl,
} from './constants';
import { EventDataType, Result, Task, TaskConfig, ProofVerifyParams, VerifyResult, ChainType } from './types';
import { ErrorCode, TransgateError } from './error';
import { Attest, SolanaTask } from './solanaInstruction';
import {
  getObjectValues,
  hexToBytes,
  insertQrcodeMask,
  getDeviceType,  
  injectMetaTag,
  launchApp,
  insertMobileDialog,
  removeMetaTag,
} from './helper';
import { signVerify } from '@ton/crypto';

export default class TransgateConnect {
  readonly appid: string;
  readonly baseServer: string;
  transgateAvailable?: boolean;
  terminal?: boolean;
  removeModal?: () => void;
  constructor(appid: string) {
    this.appid = appid;
    this.baseServer = server;
    this.terminal = false;
  }

  async launch(schemaId: string, address?: Address) {
    return await this.runTransgate({ schemaId, address, chainType: 'evm' });
  }

  async launchWithSolana(schemaId: string, address: string) {
    return await this.runTransgate({ schemaId, address, chainType: 'sol' });
  }

  async launchWithTon(schemaId: string, address: string) {
    return await this.runTransgate({ schemaId, address, chainType: 'ton' });
  }

  async runTransgate({
    schemaId,
    address,
    chainType = 'evm',
  }: {
    schemaId: string;
    address?: Address;
    chainType?: ChainType;
  }) {
    this.terminal = false;
    const device = getDeviceType();

    if (device === 'iOS') {
      this.handleIOSModal();
    }

    this.transgateAvailable = await this.isTransgateAvailable();

    const config = await this.requestConfig();
    if (config.schemas.findIndex((schema) => schema.schema_id === schemaId) === -1) {
      throw new TransgateError(ErrorCode.ILLEGAL_SCHEMA_ID, 'Illegal schema id, please check your schema info');
    }

    const taskInfo = await this.requestTaskInfo(config.task_rpc, config.token, schemaId, chainType);

    const callbackUrl = config.callbackUrl || DefaultCallbackUrl;
    const appBasePath = 'https://app.zkpass.org/verify';

    let query = `app_id=${this.appid}&task_id=${taskInfo.task}&schema_id=${schemaId}&chain_type=${chainType}&callback_url=${callbackUrl}`;

    if (address) {
      query = `${query}/&account=${address}`;
    }
    if (device === 'Android') {
      window.location.href = `${appBasePath}?${query}`;
      return await this.getProofInfo(taskInfo.task, callbackUrl);
    } else if (device === 'iOS') {
      removeMetaTag('apple-itunes-app');
      injectMetaTag(
        'apple-itunes-app',
        'app-clip-bundle-id=com.zkpass.transgate.clip, app-id=6738957441 app-clip-display=card',
      );
      const clipUrl = `https://appclip.apple.com/id?p=com.zkpass.transgate.clip&${query}`;
      this.handleIOSApp(clipUrl);
      return await this.getProofInfo(taskInfo.task, callbackUrl);
    } else if (this.transgateAvailable) {
      //support mobile but transgate is available and not mobile
      return await this.runTransgateExtension({ schemaId, address, taskInfo, chainType });
    } else {
      //support mobile but transgate is not available generate a qrcode
      const launchUrl = `${appBasePath}?${query}`;
      return await this.runWithTransgateApp(launchUrl, taskInfo.task, callbackUrl);
    }
  }

  private async runWithTransgateApp(launchUrl: string, taskId: string, callbackUrl: string) {
    try {
      const { canvasElement, remove } = insertQrcodeMask();

      await QRCode.toCanvas(canvasElement, launchUrl, {
        width: 240,
      });

      const closeBtn = document.getElementById('close-transgate');
      const zkpassCanvas = document.getElementById('zkpass-canvas');

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
    chainType = 'evm',
  }: {
    schemaId: string;
    taskInfo: Task;
    address?: Address;
    chainType?: ChainType;
  }) {
    const schemaUrl = `${this.baseServer}/schema/${schemaId}`;
    const schemaInfo = await this.requestSchemaInfo(schemaUrl);
    console.log('runTransgateExtension address', address);
    const {
      task,
      alloc_address: allocatorAddress,
      alloc_signature: signature,
      node_address: nodeAddress,
      node_host: nodeHost,
      node_pk: nodePK,
    } = taskInfo;

    const extensionParams = {
      task,
      allocatorAddress,
      nodeAddress,
      nodeHost,
      nodePK,
      signature,
      ...schemaInfo,
      appid: this.appid,
    };

    if (!this.checkTaskInfo(chainType, task, schemaId, nodeAddress, signature)) {
      return new TransgateError(ErrorCode.ILLEGAL_TASK_INFO, 'Please ensure you connected the legitimate task nodes');
    }

    this.launchTransgate(extensionParams, address);

    return new Promise((resolve, reject) => {
      const eventListener = (event: any) => {
        if (event.data.id !== extensionParams.id) {
          return;
        }
        if (event.data.type === EventDataType.INVALID_SCHEMA) {
          reject(new TransgateError(ErrorCode.ILLEGAL_SCHEMA, 'Incorrect schema information.'));
        } else if (event.data.type === EventDataType.GENERATE_ZKP_SUCCESS) {
          window?.removeEventListener('message', eventListener);
          const message: VerifyResult = event.data;
          const { publicFields = [] } = message;
          const publicData = getObjectValues(
            publicFields.map((item: any) => {
              delete item.str;
              return item;
            }),
          );

          console.log('publicData', publicData);
          console.log('address', address);

          const proofResult = this.buildResult(message, taskInfo, publicData, allocatorAddress, address);
          console.log('proofResult', JSON.stringify(proofResult));
          if (this.verifyProofMessageSignature(chainType, schemaId, proofResult)) {
            console.log('proofResult', proofResult);
            resolve(proofResult);
          } else {
            reject(
              new TransgateError(
                ErrorCode.ILLEGAL_NODE,
                'The verification node is not the same as the node assigned to the task.',
              ),
            );
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
    });
  }

  private launchTransgate(taskInfo: any, address?: Address) {
    window?.postMessage(
      {
        type: 'AUTH_ZKPASS',
        mintAccount: address,
        ...taskInfo,
      },
      '*',
    );
  }

  /**
   * request task info
   * @param {*} schemaId string schema id
   * @returns
   */
  private async requestTaskInfo(taskUrl: string, token: string, schemaId: string, chainType: ChainType): Promise<Task> {
    const response = await fetch(`https://${taskUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        schema_id: schemaId,
        app_id: this.appid,
        chain_type: chainType,
        debug: false,
      }),
    });
    if (response.ok) {
      const result = await response.json();
      return result.info;
    }

    throw new TransgateError(ErrorCode.TASK_RPC_ERROR, 'Request task info error');
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
          reject(new TransgateError(ErrorCode.REQUEST_TIMEOUT, 'Request timeout, please try again'));
          return;
        }

        if (this.terminal) {
          reject(new TransgateError(ErrorCode.VERIFICATION_CANCELED, 'User terminal the validation.'));
          return;
        }

        setTimeout(async () => {
          try {
            const response = await fetch(`${callbackUrl}?task_index=${taskId}`);
            if (response.ok) {
              const res = await response.json();
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
    const closeBtn = document.getElementById('close-transgate');
    closeBtn?.addEventListener('click', () => {
      remove();
      this.terminal = true;
    });
  }

  handleIOSApp(clipUrl: string) {
    const loading_box = document.getElementById('loading-box');
    loading_box?.remove();
    const complete_box = document.getElementById('complete-box');
    const verify_button = document.getElementById('verify-button');
    if (complete_box) {
      complete_box.style.display = 'flex';
      verify_button?.addEventListener('click', () => {
        this.removeModal && this.removeModal();
        launchApp(clipUrl);
      });
    }
  }

  checkTaskInfo(chainType: ChainType, task: string, schema: string, validatorAddress: string, signature: string) {
    if (chainType === 'sol') {
      return this.checkTaskInfoForSolana(task, schema, validatorAddress, signature);
    } else if (chainType === 'ton') {
      return this.checkTaskInfoForTon(task, schema, validatorAddress, signature);
    }

    const taskHex = Web3.utils.stringToHex(task);
    const schemaHex = Web3.utils.stringToHex(schema);

    return this.checkTaskInfoForEVM(taskHex, schemaHex, validatorAddress, signature);
  }

  checkTaskInfoForSolana(task: string, schema: string, validatorAddress: string, signature: string) {
    const sig_bytes = hexToBytes(signature.slice(2));

    const signatureBytes = sig_bytes.slice(0, 64);
    const recoverId = Array.from(sig_bytes.slice(64))[0];

    const plaintext = borsh.serialize(SolanaTask, {
      task: task,
      schema: schema,
      notary: validatorAddress,
    });

    const plaintextHash = Buffer.from(sha3.keccak_256.digest(Buffer.from(plaintext)));

    const address = secp256k1.ecdsaRecover(signatureBytes, recoverId, plaintextHash, false);

    return SolanaTaskAllocator === sha3.keccak_256.hex(address.slice(1));
  }

  checkTaskInfoForTon(task: string, schema: string, validatorAddress: string, signature: string) {
    const taskCell = beginCell()
      .storeBuffer(Buffer.from(task, 'ascii'))
      .storeBuffer(Buffer.from(schema, 'ascii'))
      .storeBuffer(Buffer.from(validatorAddress, 'hex'))
      .endCell();
    const taskVerify = signVerify(taskCell.hash(), Buffer.from(signature, 'hex'), Buffer.from(TonTaskPubKey, 'hex'));
    return taskVerify;
  }

  checkTaskInfoForEVM(task: string, schema: string, validatorAddress: string, signature: string) {
    const web3 = new Web3();

    const encodeParams = web3.eth.abi.encodeParameters(
      ['bytes32', 'bytes32', 'address'],
      [task, schema, validatorAddress],
    );
    const paramsHash = Web3.utils.soliditySha3(encodeParams) as string;

    const signedAllocatorAddress = web3.eth.accounts.recover(paramsHash, signature);

    return EVMTaskAllocator === signedAllocatorAddress;
  }

  /**
   * check the proof result by chain type
   * @param chainType
   * @param schema
   * @param proofResult
   * @returns
   */
  verifyProofMessageSignature(chainType: ChainType, schema: string, proofResult: Result) {
    const { taskId, publicFieldsHash, uHash, validatorAddress, validatorSignature, recipient } = proofResult;

    const taskHex = Web3.utils.stringToHex(taskId) as string;
    const schemaHex = Web3.utils.stringToHex(schema) as string;

    if (chainType === 'sol') {
      const rec = recipient as string;

      return this.verifyMessageSignatureForSolana({
        taskId,
        uHash,
        validatorAddress,
        schema,
        validatorSignature,
        recipient: rec,
        publicFieldsHash,
      });
    } else if (chainType === 'ton') {
      const rec = recipient as string;
      return this.verifyMessageSignatureForTon({
        taskId,
        uHash,
        validatorAddress,
        schema,
        validatorSignature,
        recipient: rec,
        publicFieldsHash,
      });
    }

    return this.verifyEVMMessageSignature(
      taskHex,
      schemaHex,
      uHash,
      publicFieldsHash,
      validatorSignature,
      validatorAddress,
      recipient,
    );
  }

  verifyEVMMessageSignature(
    taskId: string,
    schema: string,
    nullifier: string,
    publicFieldsHash: string,
    signature: string,
    originAddress: string,
    recipient?: string,
  ) {
    const web3 = new Web3();

    const types = ['bytes32', 'bytes32', 'bytes32', 'bytes32'];
    const values = [taskId, schema, nullifier, publicFieldsHash];

    if (recipient) {
      types.push('address');
      values.push(recipient);
    }

    const encodeParams = web3.eth.abi.encodeParameters(types, values);

    const paramsHash = Web3.utils.soliditySha3(encodeParams) as string;

    const nodeAddress = web3.eth.accounts.recover(paramsHash, signature);
    return nodeAddress === originAddress;
  }
  /**
   * check signature is matched with task info
   * @param params
   * @returns
   */
  verifyMessageSignatureForSolana(params: ProofVerifyParams): boolean {
    const { taskId, uHash, validatorAddress, schema, validatorSignature, recipient, publicFieldsHash } = params;

    const sig_bytes = hexToBytes(validatorSignature.slice(2));

    const signatureBytes = sig_bytes.slice(0, 64);
    const recoverId = Array.from(sig_bytes.slice(64))[0];

    const plaintext = borsh.serialize(Attest, {
      task: taskId,
      nullifier: uHash,
      schema,
      recipient,
      publicFieldsHash,
    });

    const plaintextHash = Buffer.from(sha3.keccak_256.digest(Buffer.from(plaintext)));

    const address = secp256k1.ecdsaRecover(signatureBytes, recoverId, plaintextHash, false);

    return validatorAddress === sha3.keccak_256.hex(address.slice(1));
  }
  private buildResult(
    data: VerifyResult,
    taskInfo: Task,
    publicData: string,
    allocatorAddress: string,
    recipient?: string,
  ): Result {
    const { publicFields, taskId, nullifierHash, signature } = data;
    const { node_address: nodeAddress, alloc_signature: allocSignature } = taskInfo;
    const publicFieldsHash = Web3.utils.soliditySha3(
      !!publicData ? Web3.utils.stringToHex(publicData) : Web3.utils.utf8ToHex('1'),
    ) as string;

    return {
      taskId,
      publicFields,
      allocatorAddress,
      publicFieldsHash,
      allocatorSignature: allocSignature,
      uHash: nullifierHash,
      validatorAddress: nodeAddress,
      validatorSignature: signature,
      recipient,
    };
  }

  verifyMessageSignatureForTon(params: ProofVerifyParams): boolean {
    const { taskId, uHash, validatorAddress, schema, validatorSignature, recipient, publicFieldsHash } = params;

    const attestationCell = beginCell()
      .storeRef(
        beginCell()
          .storeBuffer(Buffer.from(taskId, 'ascii'))
          .storeBuffer(Buffer.from(schema, 'ascii'))
          .storeBuffer(Buffer.from(uHash.slice(2), 'hex'))
          .endCell(),
      )
      .storeAddress(TonAddress.parse(recipient))
      .storeRef(
        beginCell()
          .storeBuffer(Buffer.from(publicFieldsHash.slice(2), 'hex'))
          .endCell(),
      )
      .endCell();
    const attestationVerify = signVerify(
      attestationCell.hash(),
      Buffer.from(validatorSignature.slice(2), 'hex'),
      Buffer.from(validatorAddress, 'hex'),
    );

    return attestationVerify;
  }

  async isTransgateAvailable() {
    try {
      const url = `chrome-extension://${extensionId}/images/icon-16.png`;
      const { statusText } = await fetch(url);
      if (statusText === 'OK') {
        this.transgateAvailable = true;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}
