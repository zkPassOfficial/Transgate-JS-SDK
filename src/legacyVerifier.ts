import Web3 from 'web3';
import { Buffer } from 'buffer';
import secp256k1 from 'secp256k1';
import * as borsh from 'borsh';
import sha3 from 'js-sha3';
import { Address as TonAddress, beginCell } from '@ton/ton';
import { signVerify } from '@ton/crypto';
import { EVMTaskAllocator, SignatureVmValue, SolanaTaskAllocator, TonTaskPubKey } from './constants';
import { hexToBytes } from './helper';
import { Attest, SolanaTask } from './solanaInstruction';
import { ProofVerifyParams, Result, SignatureVm } from './types';

export function checkTaskInfoForSolana(task: string, schema: string, validatorAddress: string, signature: string) {
  const signatureBytesWithRecovery = hexToBytes(signature.slice(2));
  const signatureBytes = signatureBytesWithRecovery.slice(0, 64);
  const recoverId = Array.from(signatureBytesWithRecovery.slice(64))[0];
  const plaintext = borsh.serialize(SolanaTask, { task, schema, notary: validatorAddress });
  const plaintextHash = Buffer.from(sha3.keccak_256.digest(Buffer.from(plaintext)));
  const address = secp256k1.ecdsaRecover(signatureBytes, recoverId, plaintextHash, false);
  return SolanaTaskAllocator === sha3.keccak_256.hex(address.slice(1));
}

export function checkTaskInfoForTon(task: string, schema: string, validatorAddress: string, signature: string) {
  const taskCell = beginCell()
    .storeBuffer(Buffer.from(task, 'ascii'))
    .storeBuffer(Buffer.from(schema, 'ascii'))
    .storeBuffer(Buffer.from(validatorAddress, 'hex'))
    .endCell();
  return signVerify(taskCell.hash(), Buffer.from(signature, 'hex'), Buffer.from(TonTaskPubKey, 'hex'));
}

export function checkTaskInfoForEVM(task: string, schema: string, validatorAddress: string, signature: string) {
  const web3 = new Web3();
  const encoded = web3.eth.abi.encodeParameters(['bytes32', 'bytes32', 'address'], [task, schema, validatorAddress]);
  const paramsHash = Web3.utils.soliditySha3(encoded) as string;
  return EVMTaskAllocator === web3.eth.accounts.recover(paramsHash, signature);
}

export function checkTaskInfo(
  vm: SignatureVm,
  task: string,
  schema: string,
  validatorAddress: string,
  signature: string,
) {
  if (vm === SignatureVmValue.SVM) {
    return checkTaskInfoForSolana(task, schema, validatorAddress, signature);
  }
  if (vm === SignatureVmValue.TVM) {
    return checkTaskInfoForTon(task, schema, validatorAddress, signature);
  }
  return checkTaskInfoForEVM(Web3.utils.stringToHex(task), Web3.utils.stringToHex(schema), validatorAddress, signature);
}

export function verifyEVMMessageSignature(
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
  const encoded = web3.eth.abi.encodeParameters(types, values);
  const paramsHash = Web3.utils.soliditySha3(encoded) as string;
  return web3.eth.accounts.recover(paramsHash, signature) === originAddress;
}

export function verifyMessageSignatureForSolana(params: ProofVerifyParams): boolean {
  const { taskId, uHash, validatorAddress, schema, validatorSignature, recipient, publicFieldsHash } = params;
  const signatureBytesWithRecovery = hexToBytes(validatorSignature.slice(2));
  const signatureBytes = signatureBytesWithRecovery.slice(0, 64);
  const recoverId = Array.from(signatureBytesWithRecovery.slice(64))[0];
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

export function verifyMessageSignatureForTon(params: ProofVerifyParams): boolean {
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
  return signVerify(
    attestationCell.hash(),
    Buffer.from(validatorSignature.slice(2), 'hex'),
    Buffer.from(validatorAddress, 'hex'),
  );
}

export function verifyProofMessageSignature(vm: SignatureVm, schema: string, proofResult: Result) {
  const { taskId, publicFieldsHash, uHash, validatorAddress, validatorSignature, recipient } = proofResult;
  if (vm === SignatureVmValue.SVM) {
    return verifyMessageSignatureForSolana({
      taskId,
      uHash,
      validatorAddress,
      schema,
      validatorSignature,
      recipient: recipient as string,
      publicFieldsHash,
    });
  }
  if (vm === SignatureVmValue.TVM) {
    return verifyMessageSignatureForTon({
      taskId,
      uHash,
      validatorAddress,
      schema,
      validatorSignature,
      recipient: recipient as string,
      publicFieldsHash,
    });
  }
  return verifyEVMMessageSignature(
    Web3.utils.stringToHex(taskId),
    Web3.utils.stringToHex(schema),
    uHash,
    publicFieldsHash,
    validatorSignature,
    validatorAddress,
    recipient,
  );
}

export class LegacyVerification {
  checkTaskInfo(vm: SignatureVm, task: string, schema: string, validatorAddress: string, signature: string) {
    return checkTaskInfo(vm, task, schema, validatorAddress, signature);
  }

  checkTaskInfoForSolana(task: string, schema: string, validatorAddress: string, signature: string) {
    return checkTaskInfoForSolana(task, schema, validatorAddress, signature);
  }

  checkTaskInfoForTon(task: string, schema: string, validatorAddress: string, signature: string) {
    return checkTaskInfoForTon(task, schema, validatorAddress, signature);
  }

  checkTaskInfoForEVM(task: string, schema: string, validatorAddress: string, signature: string) {
    return checkTaskInfoForEVM(task, schema, validatorAddress, signature);
  }

  verifyProofMessageSignature(vm: SignatureVm, schema: string, proofResult: Result) {
    return verifyProofMessageSignature(vm, schema, proofResult);
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
    return verifyEVMMessageSignature(taskId, schema, nullifier, publicFieldsHash, signature, originAddress, recipient);
  }

  verifyMessageSignatureForSolana(params: ProofVerifyParams): boolean {
    return verifyMessageSignatureForSolana(params);
  }

  verifyMessageSignatureForTon(params: ProofVerifyParams): boolean {
    return verifyMessageSignatureForTon(params);
  }
}
