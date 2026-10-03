<p align="center">
  <img src="assets/logo.png" width="300" alt="Transgate JS SDK" />
</p>

# Transgate JS SDK

![ES Version](https://img.shields.io/badge/ES-2020-yellow)

The Transgate JS SDK launches a zkPass verification task from a browser application and verifies the proof returned by the [Transgate Extension](https://chromewebstore.google.com/detail/zkpass-transgate/afkoofjocpbclhnldmmaphappihehpma).

## Prerequisites

Register a project in the [zkPass Dev Center](https://dev.zkpass.org), create a schema, and add the website origin that will call the SDK.

## Installation

Using npm:

```bash
npm install @zkpass/transgate-js-sdk
```

Using Yarn:

```bash
yarn add @zkpass/transgate-js-sdk
```

## Quick start

```ts
import TransgateConnect from '@zkpass/transgate-js-sdk';

const connector = new TransgateConnect('YOUR_APP_ID');

async function verify() {
  try {
    const result = await connector.runTransgate({
      schemaId: 'YOUR_SCHEMA_ID',
      address: '0xYourUserAddress', // Optional owner/recipient
      vm: 'evm',
    });

    console.log(result);
  } catch (error) {
    console.error('Transgate verification failed', error);
  }
}
```

`vm` defaults to `evm`. The accepted values are:

| `vm` | Target environment | Signature encoding and digest |
| ---- | ------------------ | ----------------------------- |
| `evm` | EVM chains | ABI encoding, Keccak-256 and EIP-191; signature is `r ‖ s ‖ v`, where `v` is 27 or 28 |
| `svm` | Solana | Borsh encoding and Keccak-256; signature is `r ‖ s ‖ recoveryId`, where `recoveryId` is 0 or 1 |
| `tvm` | TON | TON cell representation hash; signature is `r ‖ s ‖ recoveryId`, where `recoveryId` is 0 or 1 |

Unknown VM values, including the old `sol` and `ton` values, are rejected.

### Convenience methods

The existing convenience methods remain available:

```ts
await connector.launch(schemaId, address); // vm: evm
await connector.launchWithSolana(schemaId, address); // vm: svm
await connector.launchWithTon(schemaId, address); // vm: tvm
```

For new integrations, prefer `runTransgate` because it makes the requested VM explicit.

### Migrating from `chainType`

Use `vm` and the signature VM names:

```ts
// Before
await connector.runTransgate({ schemaId, address, chainType: 'sol' });

// Now
await connector.runTransgate({ schemaId, address, vm: 'svm' });
```

| Previous `chainType` | Current `vm` |
| -------------------- | ------------ |
| `evm` | `evm` |
| `sol` | `svm` |
| `ton` | `tvm` |

## Browser and Extension flow

When the Transgate Extension is available, the SDK and Extension use the following flow:

1. The SDK asks the Extension to prepare an ephemeral task wallet.
2. The Extension keeps the private key in extension session storage and returns only the public address.
3. The SDK requests `taskInfo` from the task allocator using that public address.
4. The SDK sends the allocated `taskInfo` and requested `vm` to the Extension.
5. The Extension generates the proof and requests `/zkp?vm=<vm>`.
6. The Extension passes the complete ZKP response to the SDK for internal verification.
7. The SDK verifies the task, schema, allocator, validator, VM and validator signature before returning a reduced result to the page.

The ephemeral private key is not exposed to the page or SDK.

If the Extension is unavailable, the SDK continues through the supported Transgate App, App Clip or QR-code flow.

## Proof verification

For Extension proofs, the SDK verifies:

- `result.taskId` and `result.schemaId` match the task allocated by the SDK.
- The ZKP allocator and signed `result.allocatorAddress` match the trusted allocator configured by the SDK.
- `result.validatorAddress` matches the validator assigned to the task, when the task response supplies one.
- `result.vm` exactly matches the VM requested by the caller.
- The validator signature recovers `result.validatorAddress` using the encoding and digest rules for `result.vm`.

The eleven signed record fields are `taskId`, `schemaId`, `validatorAddress`, `allocatorAddress`, `owner`, `verifyTimestamp`, `publicDataHash`, `uHash`, `tlsHash`, `zkpHash`, and `publicInputHash`. The `vm`, ZKP `data`, and response metadata are not part of the signed record.

## Result

The page receives the following structure after verification succeeds:

```ts
interface Result {
  allocatorAddress: string;
  allocatorSignature: string;
  publicFields: any[];
  publicFieldsHash: string;
  taskId: string;
  uHash: string;
  validatorAddress: string;
  validatorSignature: string;
  recipient?: string;
}
```

| Field | Description |
| ----- | ----------- |
| `allocatorAddress` | Trusted allocator address used by the SDK |
| `allocatorSignature` | Allocator signature from the allocated task information |
| `publicFields` | Public schema values. Internal verification-only `str` properties are removed |
| `publicFieldsHash` | Hash of the public data signed by the validator |
| `taskId` | Allocated task ID |
| `uHash` | Circuit nullifier hash. Schemas without a nullifier use the SHA-256 hash of empty data |
| `validatorAddress` | EVM-style address recovered from the validator's secp256k1 key |
| `validatorSignature` | Validator signature encoded for the requested VM |
| `recipient` | Optional task owner/recipient |

The internal ZKP `result`, `data`, and `zkpResponse` objects are used for verification but are not returned to the page.

## Error codes

| Code | Name |
| ---- | ---- |
| `100000` | `ILLEGAL_NODE` |
| `100001` | `TRANSGATE_NOT_INSTALLED` |
| `100002` | `ILLEGAL_APPID` |
| `100003` | `ILLEGAL_SCHEMA_ID` |
| `100004` | `TASK_RPC_ERROR` |
| `100005` | `CONNECT_NODE_ERROR` |
| `100006` | `ILLEGAL_TASK_INFO` |
| `100007` | `ILLEGAL_SCHEMA` |
| `110001` | `NOT_MATCH_REQUIREMENTS` |
| `110002` | `VERIFICATION_CANCELED` |
| `110003` | `UNEXPECTED_VERIFY_ERROR` |
| `120000` | `UNEXPECTED_ERROR` |
| `120001` | `REQUEST_TIMEOUT` |

## Documentation

See the [zkPass Extension JS SDK guide](https://zkpass.gitbook.io/zkpass/extension-js-sdk/quick-start) for project and schema setup.
