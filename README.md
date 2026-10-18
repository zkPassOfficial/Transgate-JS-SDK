<p align="center">
  <img src="assets/logo.png" width="300" alt="transgate-js-sdk.js" />
</p>

# Transgate JS-SDK

![ES Version](https://img.shields.io/badge/ES-2020-yellow)

The Transgate JS-SDK is a utility package for [Transgate](https://chromewebstore.google.com/detail/zkpass-transgate/afkoofjocpbclhnldmmaphappihehpma) that enables developers to easily launch Transgate.

Check out our docs for [step-by-step instructions!](https://zkpass.gitbook.io/zkpass/extension-js-sdk/quick-start)

## Register a developer account

Please register an account on the [zkPass Dev Center](https://dev.zkpass.org) and create a project. Then you can add schemas for your project.

## Installation

You can install the package either using [NPM](https://www.npmjs.com/package/@zkpass/transgate-js-sdk) or using [Yarn](https://yarnpkg.com/package/@zkpass/transgate-js-sdk)

### Using NPM

```bash
npm install @zkpass/transgate-js-sdk
```

### Using Yarn

```bash
yarn add  @zkpass/transgate-js-sdk
```

### Example
```javascript
import TransgateConnect from '@zkpass/transgate-js-sdk'

const requestVerifyMessage = async () =>{
  try{
    const appid = "8fb9d43c-2f24-424e-a98d-7ba34a5532f5" //Locate this form on the development platform

    const connector = new TransgateConnect(appid)
    const isAvailable = await connector.isTransgateAvailable()

    if(isAvailable){
      //The schema ID that you add for the project
      const schemaId = "516a720e-29a4-4307-ae7b-5aec286e446e"

      const res = await connector.launch(schemaId)// This method can be invoked in a loop when dealing with multiple schemas

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
| validatorSignature            | The signature of the verification result by the validator node      |
| recipient                     | Optional recipient supplied by the caller on the extension result path |

### Error code

| Error Code         | Description                      |
| ------------------ | -------------------------------- |
| 100000             | ILLEGAL_NODE                     |
| 100001             | TRANSGATE_NOT_INSTALLED          |
| 100002             | ILLEGAL_APPID                    |
| 100003             | ILLEGAL_SCHEMA_ID                |
| 100004             | TASK_RPC_ERROR                   |
| 100005             | CONNECT_NODE_ERROR               |
| 100006             | ILLEGAL_TASK_INFO                |
| 100007             | ILLEGAL_SCHEMA                   |
| 110001             | NOT_MATCH_REQUIREMENTS           |
| 110002             | VERIFICATION_CANCELED            |
| 110003             | UNEXPECTED_VERIFY_ERROR          |
| 120000             | UNEXPECTED_ERROR                 |
| 120001             | REQUEST_TIMEOUT                  |

## Scope of this checkout

The manifest version is `0.4.5`. This is a browser-oriented SDK: source uses `window`, `document`, extension detection, mobile UI, and QR-code helpers. Installing the npm package does not establish SSR/Node-only compatibility or hosted-service availability. The original example above is deliberately extension-only because it checks availability before launching; calling `launch` directly can enter other paths.

### Launch paths and recipients

| Method | Source behavior |
| --- | --- |
| `launch(schemaId, address?)` | EVM path; recipient is optional in the method signature |
| `launchWithSolana(schemaId, address)` | Selects the Solana path with a required address parameter |
| `launchWithTon(schemaId, address)` | Selects the TON path with a required address parameter |
| `isTransgateAvailable()` | Checks the configured extension resource; does not validate a schema, app, proof, or mobile installation |

`runTransgate` loads application configuration, checks schema membership, and requests task information. Android and iOS enter mobile launch/callback paths. Desktop uses the extension when detected; otherwise it shows a QR flow and polls for a callback result. These paths require browser UI and external services. They do not send a contract transaction merely by returning a proof.

The extension path builds the result fields listed above and checks the proof-message signature. Mobile/callback polling instead resolves `res.info` from the callback response; this function does not pass that payload through the same `buildResult`/signature-verification sequence. Validate the expected shape and trust boundary for the path used. `VerifyResult` is the extension event shape, `Result` is the constructed SDK result shape, and `ProofVerifyParams` describes separate signature-helper inputs; they are not interchangeable types.

### Errors, timing, and trust

Most failure paths throw or reject with `TransgateError`, but the extension task-check failure currently **returns** `new TransgateError(ErrorCode.ILLEGAL_TASK_INFO, ...)`. A fulfilled promise is therefore not by itself proof success; inspect the result before consuming it. The error table is the complete enum in this checkout, not a guarantee that every failure originates from that enum.

Callback and scan polling have retry-count limits, while the extension message-listener promise has no comparable timeout in its implementation. A polling limit is not a hard overall deadline for an individual network request. Closing a mobile/QR UI sets a cancellation flag observed by polling; it is not a general AbortSignal interface.

The code includes EVM, Solana, and TON signature helpers and configured allocator identities. Their presence is not an independent cryptographic audit, authorization policy, or replay-prevention guarantee. Check chain-specific encodings, expected signers, recipient binding, schema/task association, and downstream nullifier storage for the intended integration. Do not expose private callback data, proof contents, or service configuration in logs.

## Source development

A `yarn.lock` is tracked; no Node engine or automated test script is declared.

| Script | Behavior |
| --- | --- |
| `build` | `tsc` |
| `lint` | `tslint -p tsconfig.json` |
| `format` | Prettier writes source files |
| `prepare` | Runs the build during applicable package lifecycle operations |
| `version` | Formats source and stages it with `git add -A src` |
| `postversion` | Pushes commits and tags |

Version/publishing lifecycle commands are remote mutations, not routine verification commands. No install, format, build, lint, version operation, browser integration, service request, or proof/chain operation was performed in this documentation review. No tracked test suite or GitHub Actions workflow was found. External docs/package/service compatibility remains unverified. The repository has no tracked license file; this README assigns no license. `AspectaVerification.txt` is verification data and is preserved unchanged.
