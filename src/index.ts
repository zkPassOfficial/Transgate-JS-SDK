import Web3 from "web3"
import { server, devServer, extensionId } from "./constants"

declare type Address = `0x${string}`

export default class TransgateConnect {
  appid: string
  installedTransgate?: boolean
  baseServer: string
  constructor(appid: string, isDevelopMode?: boolean) {
    this.appid = appid
    this.baseServer = isDevelopMode ? devServer : server
  }

  async launch(templateId: string, address?: Address) {
    const installedTransgate = await this.isInstalledTransgate()
    if (!installedTransgate) {
      throw "Please install transgate before generate proof"
    }

    const config = await this.requestConfig()    
    if (!config.schemas[templateId]) {
      throw "Illegal template id, please check your template info!"
    }

    const templateInfo = await this.requestTemplateInfo(config.schemas[templateId])
    const task = await this.requestTaskInfo(config.taskRPC, config.token, templateId)    
    const extensionParams = {
      ...task,
      ...templateInfo,
    }

    this.launchTransgate(extensionParams, address)

    return new Promise((resolve, reject) => {
      const eventListener = (event: any) => {
        if (event.data.type == "GENERATE_ZKP_SUCCESS") {          
          window?.removeEventListener("message", eventListener)
          const message = event.data
          const { taskId, nullifierHash, publicFields = [], signature } = message
          const publicFieldsList = publicFields.map((item: any) => item.str)
          let publicData = publicFieldsList.length > 0 ? publicFieldsList.reduce((a: string, b: string) => a + b) : ""

          if (this.verifyMessage(taskId, templateId, nullifierHash, publicData, signature, task.nodeAddress)) {
            resolve(event.data)
          } else {
            reject("verify message error")
          }
        }
      }
      window?.addEventListener("message", eventListener)
    })
  }

  launchTransgate(taskInfo: any, address?: Address) {
    window?.postMessage(
      {
        type: "AUTH_ZKPASS",
        mintAccount: address,
        ...taskInfo,
      },
      "*"
    )
  }

  /**
   * request task info
   * @param {*} schemaId string template id
   * @returns
   */
  async requestTaskInfo(taskUrl: string, token: string, schemaId: string) {
    const response = await fetch(`https://${taskUrl}?token=${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schemaId,
      }),
    })
    if (response.ok) {
      return await response.json()
    }

    throw `Request task info error`
  }

  async requestConfig() {
    const response = await fetch(`${this.baseServer}/sdk/config?${new URLSearchParams({ appid: this.appid })}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })    
    if (response.ok) {
      return await response.json()
    }

    throw `Please check your rpc and appid`
  }
  /**
   * request template detail info
   * @param schemaUrl
   */
  async requestTemplateInfo(schemaUrl: string) {
    const response = await fetch(schemaUrl)    
    if (response.ok) {
      return await response.json()
    }
    throw "Illegal schema url, please contact develop team!"
  }

  async isInstalledTransgate() {
    const url = `chrome-extension://${extensionId}/images/icon-16.png`
    const { statusText } = await fetch(url)
    if (statusText == "OK") {
      this.installedTransgate = true
      return true
    }
    return false
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
  verifyMessage(
    taskId: string,
    schemaId: string,
    nullifier: string,
    publicData: string,
    signature: string,
    originAddress: string
  ) {
    const web3 = new Web3()
    let message = taskId + schemaId + nullifier + publicData
    const nodeAddress = web3.eth.accounts.recover(message, signature)
    return nodeAddress === originAddress
  }
}
