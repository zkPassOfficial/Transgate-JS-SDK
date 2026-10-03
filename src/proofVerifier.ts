import {
  AbiCoder,
  Signature,
  getAddress,
  getBytes,
  hexlify,
  id,
  keccak256,
  recoverAddress,
  verifyMessage,
} from 'ethers';
import { serialize } from 'borsh';
import { beginCell } from '@ton/core';
import { ProofRecord, SignatureVm } from './types';
import { SignatureVmValue, SupportedSignatureVms } from './constants';

type CompactSignatureVm = Exclude<SignatureVm, typeof SignatureVmValue.EVM>;

export function parseSignatureVm(vm: unknown): SignatureVm {
  if (!SupportedSignatureVms.includes(vm as SignatureVm)) {
    throw new Error(`Invalid signature VM: ${String(vm)}`);
  }
  return vm as SignatureVm;
}

function canonicalFields(record: ProofRecord) {
  return {
    taskId: id(record.taskId),
    schemaId: id(record.schemaId),
    validatorAddress: getAddress(record.validatorAddress),
    allocatorAddress: getAddress(record.allocatorAddress),
    owner: record.owner ?? '',
    verifyTimestamp: record.verifyTimestamp,
    publicDataHash: record.publicDataHash,
    uHash: record.uHash,
    tlsHash: record.tlsHash,
    zkpHash: record.zkpHash,
    publicInputHash: record.publicInputHash,
  };
}

function compactSignature(signature: string, vm: SignatureVm) {
  const bytes = getBytes(signature.startsWith('0x') ? signature : `0x${signature}`);
  if (bytes.length !== 65 || bytes[64] > 1) {
    throw new Error(`Invalid ${vm.toUpperCase()} signature`);
  }
  return Signature.from({
    r: hexlify(bytes.slice(0, 32)),
    s: hexlify(bytes.slice(32, 64)),
    v: 27 + bytes[64],
  });
}

function signatureBytes(signature: string) {
  const bytes = getBytes(signature.startsWith('0x') ? signature : `0x${signature}`);
  if (bytes.length !== 65) {
    throw new Error('Invalid signature: expected 65 bytes');
  }
  return bytes;
}

function buildSvmDigest(fields: ReturnType<typeof canonicalFields>) {
  const bytes32 = { array: { type: 'u8', len: 32 } } as const;
  const bytes20 = { array: { type: 'u8', len: 20 } } as const;
  const schema = {
    struct: {
      taskId: bytes32,
      schemaId: bytes32,
      validatorAddress: bytes20,
      allocatorAddress: bytes20,
      owner: 'string',
      verifyTimestamp: 'u64',
      publicDataHash: bytes32,
      uHash: bytes32,
      tlsHash: bytes32,
      zkpHash: bytes32,
      publicInputHash: bytes32,
    },
  } as const;
  const bytes = (value: string) => Array.from(getBytes(value));
  return keccak256(
    serialize(schema, {
      taskId: bytes(fields.taskId),
      schemaId: bytes(fields.schemaId),
      validatorAddress: bytes(fields.validatorAddress),
      allocatorAddress: bytes(fields.allocatorAddress),
      owner: fields.owner,
      verifyTimestamp: BigInt(fields.verifyTimestamp),
      publicDataHash: bytes(fields.publicDataHash),
      uHash: bytes(fields.uHash),
      tlsHash: bytes(fields.tlsHash),
      zkpHash: bytes(fields.zkpHash),
      publicInputHash: bytes(fields.publicInputHash),
    }),
  );
}

function buildTvmDigest(fields: ReturnType<typeof canonicalFields>) {
  const buffer = (value: string) => Buffer.from(getBytes(value));
  const cell = beginCell()
    .storeBuffer(buffer(fields.taskId))
    .storeBuffer(buffer(fields.schemaId))
    .storeBuffer(buffer(fields.validatorAddress))
    .storeBuffer(buffer(fields.allocatorAddress))
    .storeRef(beginCell().storeStringTail(fields.owner).endCell())
    .storeRef(
      beginCell()
        .storeUint(fields.verifyTimestamp, 64)
        .storeBuffer(buffer(fields.publicDataHash))
        .storeBuffer(buffer(fields.uHash))
        .endCell(),
    )
    .storeRef(
      beginCell()
        .storeBuffer(buffer(fields.tlsHash))
        .storeBuffer(buffer(fields.zkpHash))
        .storeBuffer(buffer(fields.publicInputHash))
        .endCell(),
    )
    .endCell();
  return hexlify(cell.hash());
}

function verifyEvmProof(signature: string, fields: ReturnType<typeof canonicalFields>) {
  const bytes = signatureBytes(signature);
  if (bytes[64] !== 27 && bytes[64] !== 28) {
    throw new Error('Invalid EVM signature: v must be 27 or 28');
  }
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ['bytes32', 'bytes32', 'address', 'address', 'string', 'uint64', ...Array(5).fill('bytes32')],
    Object.values(fields),
  );
  return verifyMessage(getBytes(keccak256(encoded)), hexlify(bytes));
}

function verifyCompactProof(signature: string, fields: ReturnType<typeof canonicalFields>, vm: CompactSignatureVm) {
  const digest = vm === SignatureVmValue.SVM ? buildSvmDigest(fields) : buildTvmDigest(fields);
  return recoverAddress(digest, compactSignature(signature, vm));
}

export function verifyExtensionProof(signature: string, record: ProofRecord): string {
  const fields = canonicalFields(record);
  const vm = parseSignatureVm(record.vm);
  let recoveredAddress: string;

  switch (vm) {
    case SignatureVmValue.EVM:
      recoveredAddress = verifyEvmProof(signature, fields);
      break;
    case SignatureVmValue.SVM:
    case SignatureVmValue.TVM:
      recoveredAddress = verifyCompactProof(signature, fields, vm);
      break;
  }

  if (getAddress(recoveredAddress) !== fields.validatorAddress) {
    throw new Error('Recovered address does not match the assigned validator');
  }
  return recoveredAddress;
}
