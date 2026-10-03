import { ExtensionProofAllocator } from './constants';
import { ExtensionTask, ProofRecord, Result, VerifyResult } from './types';

export function removeVerificationFields(publicFields: any[] = []) {
  return publicFields.map((field) => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      return field;
    }
    const publicField = { ...field };
    delete publicField.str;
    return publicField;
  });
}

export function buildExtensionResult(
  data: VerifyResult,
  taskInfo: ExtensionTask,
  record: ProofRecord,
  signature: string,
): Result {
  return {
    taskId: record.taskId,
    publicFields: removeVerificationFields(data.publicFields),
    allocatorAddress: ExtensionProofAllocator,
    allocatorSignature: taskInfo.signature,
    publicFieldsHash: record.publicDataHash,
    uHash: record.uHash,
    validatorAddress: record.validatorAddress,
    validatorSignature: signature,
    recipient: record.owner,
  };
}
