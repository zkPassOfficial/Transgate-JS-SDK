import Web3, { Address } from 'web3';
import { server, devServer, extensionId } from './constants';
import { Result, Task, TaskConfig, VerifyResult } from './types';

export default class TransgateConnect {
  readonly appid: string;
  readonly baseServer: string;
  transgateAvailable?: boolean;
  constructor(appid: string, isDevelopMode?: boolean) {
    this.appid = appid;
    this.baseServer = isDevelopMode ? devServer : server;
  }
  
  async launch(schemaId: string, address?: Address) {
    const transgateAvailable = await this.isTransgateAvailable();
    if (!transgateAvailable) {
      throw 'Please install transgate before generate proof';
    }

    const config = await this.requestConfig();
    if (!config.schemas[schemaId]) {
      throw 'Illegal schema id, please check your schema info!';
    }

    const schemaInfo = await this.requestSchemaInfo(config.schemas[schemaId]);
    const task = await this.requestTaskInfo(config.taskRPC, config.token, schemaId);
    const extensionParams = {
      ...task,
      ...schemaInfo,
    };

    this.launchTransgate(extensionParams, address);

    return new Promise((resolve, reject) => {
      const eventListener = (event: any) => {
        if (event.data.type == 'GENERATE_ZKP_SUCCESS') {
          window?.removeEventListener('message', eventListener);
          const message: VerifyResult = event.data;
          const { taskId, nullifierHash, publicFields = [], signature } = message;
          const publicFieldsList = publicFields.map((item: any) => item.str);
          let publicData = publicFieldsList.length > 0 ? publicFieldsList.reduce((a: string, b: string) => a + b) : '';

          if (this.verifyMessageSignature(taskId, schemaId, nullifierHash, publicData, signature, task.nodeAddress)) {
            resolve(this.buildResult(message, task, publicData, config.allocatorAddress));
          } else {
            reject('verify message error');
          }
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
  private async requestTaskInfo(taskUrl: string, token: string, schemaId: string): Promise<Task> {
    const response = await fetch(`https://${taskUrl}?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        schemaId,
      }),
    });
    if (response.ok) {
      return await response.json();
    }

    throw `Request task info error`;
  }

  private async requestConfig(): Promise<TaskConfig> {
    const response = await fetch(`${this.baseServer}/sdk/config?${new URLSearchParams({ appid: this.appid })}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      return await response.json();
    }

    throw `Please check your rpc and appid`;
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
    throw 'Illegal schema url, please contact develop team!';
  }

  private async isTransgateAvailable() {
    const url = `chrome-extension://${extensionId}/images/icon-16.png`;
    const { statusText } = await fetch(url);
    if (statusText == 'OK') {
      this.transgateAvailable = true;
      return true;
    }
    return false;
  }
  /**
   * check signature is matched with task info
   * @param taskId
   * @param schemaId
   * @param nullifier
   * @param publicData
   * @param signature
   * @param originAddress
   * @returns
   */
  private verifyMessageSignature(
    taskId: string,
    schemaId: string,
    nullifier: string,
    publicData: string,
    signature: string,
    originAddress: string,
  ) {
    const web3 = new Web3();

    const publicFieldsHash = !!publicData
      ? Web3.utils.soliditySha3(Web3.utils.stringToHex(publicData))
      : Web3.utils.utf8ToHex('1');

    const messageStruct = {
      taskId,
      schemaId,
      uHash: nullifier,
      publicFieldsHash,
    };

    const nodeAddress = web3.eth.accounts.recover(JSON.stringify(messageStruct), signature);
    return nodeAddress === originAddress;
  }
  private buildResult(data: VerifyResult, taskInfo: Task, publicData: string, allocatorAddress:string): Result {
    const { publicFields, taskId, nullifierHash, signature } = data;
    const { nodeAddress, allocSignature } = taskInfo;
    const publicFieldsHash = (
      !!publicData ? Web3.utils.soliditySha3(Web3.utils.stringToHex(publicData)) : Web3.utils.utf8ToHex('1')
    ) as string;

    return {
      taskId,
      allocatorAddress,
      allocatorSignature: allocSignature,
      publicFields: publicFields,
      publicFieldsHash: publicFieldsHash,
      uHash: nullifierHash,
      validatorAddress: nodeAddress,
      validatorSignature: signature,
    };
  }
}
