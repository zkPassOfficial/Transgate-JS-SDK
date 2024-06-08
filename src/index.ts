import Web3, { Address } from 'web3';
import { Buffer } from 'buffer';
import secp256k1 from 'secp256k1';
import * as borsh from 'borsh';
import sha3 from 'js-sha3';

import { server, extensionId, SolanaTaskAllocator, EVMTaskAllocator } from './constants';
import { EventDataType, Result, Task, TaskConfig, SolVerifyParams, VerifyResult, ChainType } from './types';
import { ErrorCode, TransgateError } from './error';
import { Attest, SolanaTask } from './solanaInstruction';
import { hexToBytes } from './helper';

export default class TransgateConnect {
  readonly appid: string;
  readonly baseServer: string;
  transgateAvailable?: boolean;
  constructor(appid: string) {
    this.appid = appid;
    this.baseServer = server;
  }

  async launch(schemaId: string, address?: Address) {
    return await this.runTransgate({ schemaId, address, chainType: 'evm' });
  }
  
  async launchWithSolana(schemaId: string, address: string) {
    return await this.runTransgate({ schemaId, address, chainType: 'sol' });
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
    const transgateAvailable = await this.isTransgateAvailable();
    if (!transgateAvailable) {
      throw new TransgateError(ErrorCode.TRANSGATE_NOT_INSTALLED, 'Please install transgate before generate proof.');
    }

    const config = await this.requestConfig();
    if (config.schemas.findIndex((schema) => schema.schema_id === schemaId) === -1) {
      throw new TransgateError(ErrorCode.ILLEGAL_SCHEMA_ID, 'Illegal schema id, please check your schema info');
    }

    const schemaUrl = `${this.baseServer}/schema/${schemaId}`;

    const schemaInfo = await this.requestSchemaInfo(schemaUrl);

    const taskInfo = await this.requestTaskInfo(config.task_rpc, config.token, schemaId, chainType);
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
        if (event.data.type === EventDataType.GENERATE_ZKP_SUCCESS) {
          window?.removeEventListener('message', eventListener);
          const message: VerifyResult = event.data;
          const { publicFields = [] } = message;
          const publicFieldsList = publicFields.map((item: any) => item.str);
          const publicData =
            publicFieldsList.length > 0 ? publicFieldsList.reduce((a: string, b: string) => a + b) : '';

          const proofResult = this.buildResult(message, taskInfo, publicData, allocatorAddress, address);

          if (this.verifyProofMessageSignature(chainType, schemaId, proofResult)) {
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
  private async requestTaskInfo(
    taskUrl: string,
    token: string,
    schemaId: string,
    chainType: 'evm' | 'sol',
  ): Promise<Task> {
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

  checkTaskInfo(chainType: ChainType, task: string, schema: string, validatorAddress: string, signature: string) {
    if (chainType === 'sol') {
      return this.checkTaskInfoForSolana(task, schema, validatorAddress, signature);
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
  verifyMessageSignatureForSolana(params: SolVerifyParams): boolean {
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
}