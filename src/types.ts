export interface TaskConfig {
  schemas: { [key: string]: string };
  taskRPC: string;
  token: string;
  allocatorAddress: string;
}

export interface Task {
  task: string;
  nodeAddress: string;
  nodeHost: string;
  nodePort: number;
  nodePK: string;
  allocSignature: string;
}

export interface VerifyResult {
  nullifierHash: string;
  publicFields: any[];
  signature: string;
  taskId: string;
  type: string;
}

export interface Result {
  allocatorAddress: string
  allocatorSignature: string
  publicFields: any[]
  publicFieldsHash: string
  taskId: string
  uHash: string
  validatorAddress: string
  validatorSignature: string
} 