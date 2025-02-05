export enum ErrorCode {
  'ILLEGAL_NODE' = 100000,
  'TRANSGATE_NOT_INSTALLED' = 100001,
  'ILLEGAL_APPID' = 100002,
  'ILLEGAL_SCHEMA_ID' = 100003,
  'TASK_RPC_ERROR' = 100004,
  'CONNECT_NODE_ERROR' = 100005,
  'ILLEGAL_TASK_INFO' = 100006,
  'ILLEGAL_SCHEMA' = 100007,
  'NOT_MATCH_REQUIREMENTS' = 110001,
  'VERIFICATION_CANCELED' = 110002,
  'UNEXPECTED_VERIFY_ERROR' = 110003,  
  'UNEXPECTED_ERROR' = 120000,  
  'REQUEST_TIMEOUT' = 120001  
}

export class TransgateError {
  code: number;
  message: string;
  constructor(code: ErrorCode, message: any) {
    this.message = message;
    this.code = code;
  }
}
