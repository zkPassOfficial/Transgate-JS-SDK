export enum EventDataType {
  'GENERATE_ZKP_SUCCESS' = 'GENERATE_ZKP_SUCCESS',
  'NOT_MATCH_REQUIREMENTS' = 'NOT_MATCH_REQUIREMENTS',
  'ILLEGAL_WINDOW_CLOSING' = 'ILLEGAL_WINDOW_CLOSING',
  'UNEXPECTED_VERIFY_ERROR' = 'UNEXPECTED_VERIFY_ERROR',
  'INVALID_SCHEMA' = 'INVALID_SCHEMA',
  'TRANSGATE_TASK_READY' = 'TRANSGATE_TASK_READY',
}

export declare type ChainType = 'evm' | 'sol' | 'ton';

export declare type SignatureVm = 'evm' | 'svm' | 'tvm';

export interface TaskConfig {
  schemas: { schema_id: string }[];
  task_rpc: string;
  token: string;
  callbackUrl?: string;
}

export interface Task {
  task: string;
  node_address: string;
  node_host: string;
  node_port: number;
  node_pk: string;
  alloc_address: string;
  alloc_signature: string;
}

export interface ExtensionTask {
  task_id: string;
  schema_id: string;
  dev_center_address: string;
  signature: string;
  node_address?: string;
  validator_address?: string;
  node_host?: string;
  nodeHost?: string;
  node_pk?: string;
  nodePK?: string;
}

export interface ProofRecord {
  taskId: string;
  schemaId: string;
  validatorAddress: string;
  allocatorAddress: string;
  owner?: string;
  verifyTimestamp: number;
  publicDataHash: string;
  uHash: string;
  tlsHash: string;
  zkpHash: string;
  publicInputHash: string;
  vm?: SignatureVm;
}

export interface ZkpResponse {
  result: ProofRecord;
  signature: string;
  allocator?: string;
  validator?: unknown;
  data?: unknown;
  [key: string]: unknown;
}

export interface VerifyResult {
  nullifierHash: string;
  publicFields: any[];
  signature: string;
  taskId: string;
  type: string;
  result?: ProofRecord;
  validatorAddress?: string;
  allocatorAddress?: string;
  data?: unknown;
  zkpResponse?: ZkpResponse;
}

export interface ExtensionWallet {
  taskRequestId: string;
  ephemeralAddress: string;
}

export interface ProofVerifyParams {
  taskId: string;
  schema: string;
  uHash: string;
  validatorSignature: string;
  validatorAddress: string;
  publicFieldsHash: string;
  recipient: string;
}

export interface Result {
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
