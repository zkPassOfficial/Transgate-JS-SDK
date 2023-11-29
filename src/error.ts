export enum ErrorCode {
  'ILLEGAL_NODE' = 100000,
  'TRANSGATE_NOT_EXIST' = 100001,
  'APPID_ERROR' = 100002,
  'SCHEMA_ID_NOT_EXIST' = 100003,
  'SCHEMA_NOT_EXIST' = 100004,
  'CONNECT_ERROR' = 100005,
  'TASK_RPC_ERROR' = 100006,
  'NOT_MATCH_REQUIREMENTS' = 100011,
  'WINDOW_CLOSE_ERROR' = 100012,  
}

export default class TransgateError {
  code: number;
  message: string;
  constructor(code: ErrorCode, message: string) {
    this.message = message;
    this.code = code;
  }
}
