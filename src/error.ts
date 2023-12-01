export enum ErrorCode {
  'ILLEGAL_NODE' = 100000,
  'TRANSGATE_NOT_INSTALLED' = 100001,
  'ILLEGAL_APPID' = 100002,
  'ILLEGAL_SCHEMA_ID' = 100003,
  'TASK_RPC_ERROR' = 100004,  
  'CONNECT_NODE_ERROR' = 100005,
  'NOT_MATCH_REQUIREMENTS' = 110001,
  'VERIFICATION_CANCELED' = 110002,  
}

export default class TransgateError {
  code: number;
  message: string;
  constructor(code: ErrorCode, message: string) {
    this.message = message;
    this.code = code;
  }
}