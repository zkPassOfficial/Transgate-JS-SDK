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
      const appid = "7af1d0768b8a4099f4d0212e0ee6193" //Locate this form on the development platform

      const transgate = new TransgateConnect(appid, true)
      const installed = await transgate.isInstalledTransgate()

      if(installed){
        //The schema ID that you add for the project
        const schemaId = "0x280e70807f080458b3d1016d56a1eb7137af1d0768b8a4099f4d0212e0ee6193"

        const res = await transgate.launch(schemaId)// This method can be invoked in a loop when dealing with multiple schemas

        //You have the flexibility to handle the validation results based on your requirements.
        console.log("res=======>", res)

      }else{
        alert('Please install zkPass Transgate from https://chromewebstore.google.com/detail/zkpass-transgate/afkoofjocpbclhnldmmaphappihehpma')
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


