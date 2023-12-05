<p align="center">
  <img src="assets/logo.png" width="300" alt="transgate-js-sdk.js" />
</p>

# Transgate JS-SDK

![ES Version](https://img.shields.io/badge/ES-2020-yellow)

The Transgate JS-SDK is a utility package for [Transgate](https://chromewebstore.google.com/detail/zkpass-transgate/afkoofjocpbclhnldmmaphappihehpma) that enables developers to easily launch Transgate.

## Register an develop account

Please register an account on the [zkPass Dev Center](https://dev.zkapss.org/dashboard) and create a project. Then you can add schemas for your project.

## Installation

You can install the package either using [NPM](https://www.npmjs.com/package/transgate-js-sdk) or using [Yarn](https://yarnpkg.com/package/transgate-js-sdk)

### Using NPM

```bash
npm install transgate-js-sdk
```

### Using Yarn

```bash
yarn add transgate-js-sdk
```

### Example
```bash
import TransgateConnect from 'transgate-js-sdk'

const requestVerifyMessage = async () =>{
  try{
    const appid = "8fb9d43c-2f24-424e-a98d-7ba34a5532f5" //Locate this form on the development platform

    const transgate = new TransgateConnect(appid)
    const isAvailable = await transgate.isTransgateAvailable()

    if(isAvailable){
      //The schema ID that you add for the project
      const schemaId = "516a720e-29a4-4307-ae7b-5aec286e446e"

      const res = await transgate.launch(schemaId)// This method can be invoked in a loop when dealing with multiple schemas

      //You have the flexibility to handle the validation results based on your requirements.        

    }else{
      console.log('Please install zkPass Transgate from https://chromewebstore.google.com/detail/zkpass-transgate/afkoofjocpbclhnldmmaphappihehpma')
    }
  }catch(error){
    console.log('transgate error', error)
  }
}
  
```

### Verify result fields

| Field Name                    | Description                                                         | 
| ----------------------------- | ------------------------------------------------------------------- |
| allocatorAddress              | The address of the allocator node                                   |
| allocatorSignature            | Signature of the task information by the allocator node             |
| publicFields                  | Values of public fields defined in schema                           |                               
| publicFieldsHash              | Hash of public fields values                                        |                               
| taskId                        | Unique id of the task allocated by the allocator node               |                               
| uHash                         | Hash value of user unique id in the data source                     |
| validatorAddress              | The address of the validator node                                   |                               
| validatorSignature            | The signature of the verification result by the allocator node      |   

### Error code

| Error Code         | Description                      | 
| ------------------ | -------------------------------- |
| 100000             | ILLEGAL_NODE                     |
| 100001             | TRANSGATE_NOT_INSTALLED          |
| 100002             | ILLEGAL_APPID                    |                               
| 100003             | ILLEGAL_SCHEMA_ID                |                               
| 100004             | TASK_RPC_ERROR                   |                               
| 100005             | CONNECT_NODE_ERROR               |
| 110001             | NOT_MATCH_REQUIREMENTS           |  
| 110002             | VERIFICATION_CANCELED            |
| 110003             | UNEXPECTED_VERIFY_ERROR          |  