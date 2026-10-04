const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AbiCoder, Wallet, concat, getBytes, hexlify, id, keccak256 } = require('ethers');
const { serialize } = require('borsh');
const { beginCell } = require('@ton/core');
const { parseSignatureVm, verifyExtensionProof } = require('../lib/proofVerifier');
const { ErrorCode, TransgateError } = require('../lib/error');
const TransgateConnect = require('../lib').default;
const { ExtensionProofAllocator, ExtensionTaskUrl } = require('../lib/constants');

const wallet = Wallet.createRandom();
const hash = keccak256(new Uint8Array());
const baseRecord = {
  taskId: '89561595171255008',
  schemaId: 'b938ba03490d4a1bb636c20cd39b070a',
  validatorAddress: wallet.address,
  allocatorAddress: ExtensionProofAllocator,
  owner: 'owner',
  verifyTimestamp: 1789579587,
  publicDataHash: hash,
  uHash: hash,
  tlsHash: hash,
  zkpHash: hash,
  publicInputHash: hash,
};

function fields(record) {
  return {
    taskId: id(record.taskId),
    schemaId: id(record.schemaId),
    validatorAddress: record.validatorAddress,
    allocatorAddress: record.allocatorAddress,
    owner: record.owner,
    verifyTimestamp: record.verifyTimestamp,
    publicDataHash: record.publicDataHash,
    uHash: record.uHash,
    tlsHash: record.tlsHash,
    zkpHash: record.zkpHash,
    publicInputHash: record.publicInputHash,
  };
}

function compactSign(digest) {
  const signature = wallet.signingKey.sign(digest);
  return hexlify(concat([signature.r, signature.s, new Uint8Array([signature.yParity])]));
}

async function sign(record) {
  const canonical = fields(record);
  if (record.vm === 'evm') {
    const encoded = AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'address', 'address', 'string', 'uint64', ...Array(5).fill('bytes32')],
      Object.values(canonical),
    );
    return wallet.signMessage(getBytes(keccak256(encoded)));
  }
  if (record.vm === 'svm') {
    const bytes32 = { array: { type: 'u8', len: 32 } };
    const bytes20 = { array: { type: 'u8', len: 20 } };
    const bytes = (value) => Array.from(getBytes(value));
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
    };
    return compactSign(
      keccak256(
        serialize(schema, {
          taskId: bytes(canonical.taskId),
          schemaId: bytes(canonical.schemaId),
          validatorAddress: bytes(canonical.validatorAddress),
          allocatorAddress: bytes(canonical.allocatorAddress),
          owner: canonical.owner,
          verifyTimestamp: BigInt(canonical.verifyTimestamp),
          publicDataHash: bytes(hash),
          uHash: bytes(hash),
          tlsHash: bytes(hash),
          zkpHash: bytes(hash),
          publicInputHash: bytes(hash),
        }),
      ),
    );
  }
  const buffer = (value) => Buffer.from(getBytes(value));
  const cell = beginCell()
    .storeBuffer(buffer(canonical.taskId))
    .storeBuffer(buffer(canonical.schemaId))
    .storeBuffer(buffer(canonical.validatorAddress))
    .storeBuffer(buffer(canonical.allocatorAddress))
    .storeRef(beginCell().storeStringTail(canonical.owner).endCell())
    .storeRef(
      beginCell()
        .storeUint(canonical.verifyTimestamp, 64)
        .storeBuffer(buffer(hash))
        .storeBuffer(buffer(hash))
        .endCell(),
    )
    .storeRef(beginCell().storeBuffer(buffer(hash)).storeBuffer(buffer(hash)).storeBuffer(buffer(hash)).endCell())
    .endCell();
  return compactSign(hexlify(cell.hash()));
}

test('verifies the canonical Extension proof for every VM', async () => {
  for (const vm of ['evm', 'svm', 'tvm']) {
    const record = { ...baseRecord, vm };
    assert.equal(verifyExtensionProof(await sign(record), record), wallet.address);
  }
});

test('accepts only the documented VM values', () => {
  for (const vm of ['evm', 'svm', 'tvm']) assert.equal(parseSignatureVm(vm), vm);
  for (const vm of ['sol', 'ton', 'invalid', undefined]) {
    assert.throws(() => parseSignatureVm(vm), /Expected one of: evm, svm, tvm/);
  }
});

test('returns SDK errors as standard Error instances with a readable cause', () => {
  const cause = new Error('network unavailable');
  const error = new TransgateError(ErrorCode.UNEXPECTED_ERROR, cause);

  assert.ok(error instanceof Error);
  assert.equal(error.name, 'TransgateError');
  assert.equal(error.code, ErrorCode.UNEXPECTED_ERROR);
  assert.equal(error.message, 'network unavailable');
  assert.equal(error.cause, cause);
});

test('rejects a proof whose signed record was changed', async () => {
  const record = { ...baseRecord, vm: 'evm' };
  const signature = await sign(record);
  assert.throws(() => verifyExtensionProof(signature, { ...record, taskId: 'other' }));
  assert.throws(() => verifyExtensionProof(signature, { ...record, vm: 'invalid' }), /Invalid signature VM/);
  const invalidV = `${signature.slice(0, -2)}00`;
  assert.throws(() => verifyExtensionProof(invalidV, record), /Expected 27 or 28/);
});

test('obtains only the ephemeral public address from the Extension', async (t) => {
  const previousWindow = global.window;
  const listeners = new Set();
  global.window = {
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
    postMessage: (message) => {
      assert.equal(message.type, 'PREPARE_ZKPASS_TASK');
      setImmediate(() => {
        for (const listener of listeners) {
          listener({
            source: global.window,
            data: {
              type: 'TRANSGATE_TASK_READY',
              taskRequestId: message.taskRequestId,
              ephemeralAddress: wallet.address,
            },
          });
        }
      });
    },
  };
  t.after(() => {
    global.window = previousWindow;
  });
  const prepared = await new TransgateConnect('app').prepareExtensionWallet();
  assert.equal(prepared.ephemeralAddress, wallet.address);
  assert.equal('ephemeralPrivateKey' in prepared, false);
  assert.equal(listeners.size, 0);
});

test('SDK applies for Extension taskInfo with the prepared address', async (t) => {
  const previousFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ task_id: 'task', schema_id: 'schema' }) };
  };
  t.after(() => {
    global.fetch = previousFetch;
  });
  await new TransgateConnect('app').requestExtensionTaskInfo('schema', 'api.example', wallet.address, 'owner');
  assert.equal(request.url, ExtensionTaskUrl);
  assert.deepEqual(JSON.parse(request.options.body), {
    app_id: 'app',
    schema_id: 'schema',
    host: 'api.example',
    ephemeral_address: wallet.address,
    owner: 'owner',
  });
});

test('describes task allocation HTTP failures with schema and status', async (t) => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503, statusText: 'Service Unavailable' });
  t.after(() => {
    global.fetch = previousFetch;
  });

  await assert.rejects(
    new TransgateConnect('app').requestExtensionTaskInfo('schema-1', 'api.example', wallet.address),
    (error) => {
      assert.ok(error instanceof TransgateError);
      assert.equal(error.code, ErrorCode.TASK_RPC_ERROR);
      assert.match(error.message, /Extension task allocation for schema "schema-1" failed with HTTP 503/);
      return true;
    },
  );
});

test('passes the requested VM to Extension and verifies that VM signature', async (t) => {
  const previousWindow = global.window;
  const listeners = new Set();
  const record = { ...baseRecord, vm: 'svm' };
  const signature = await sign(record);
  const zkpResponse = {
    result: record,
    signature,
    validator: { source: 'zkp-service' },
    data: { publicData: '0x1234' },
    requestId: 'zkp-request-1',
  };
  global.window = {
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
    postMessage: (message) => {
      assert.equal(message.type, 'AUTH_ZKPASS');
      assert.equal(message.taskInfo.task_id, record.taskId);
      assert.equal(message.taskRequestId, 'request-1');
      assert.equal(message.vm, 'svm');
      assert.equal('ephemeralPrivateKey' in message, false);
      setImmediate(() => {
        for (const listener of listeners) {
          listener({
            source: global.window,
            data: {
              id: record.schemaId,
              type: 'GENERATE_ZKP_SUCCESS',
              taskId: record.taskId,
              publicFields: [{ key: 'name', value: 'Alice', str: 'verification-only' }],
              zkpResponse,
            },
          });
        }
      });
    },
  };
  t.after(() => {
    global.window = previousWindow;
  });
  const client = new TransgateConnect('app');
  const result = await client.runTransgateExtension({
    schemaId: record.schemaId,
    taskInfo: {
      task_id: record.taskId,
      schema_id: record.schemaId,
      dev_center_address: Wallet.createRandom().address,
      signature: 'task-signature',
      node_address: record.validatorAddress,
    },
    schemaInfo: { id: record.schemaId, nodeHost: 'node.example', nodePK: 'pk' },
    taskRequestId: 'request-1',
    ephemeralAddress: wallet.address,
    vm: 'svm',
  });
  assert.equal(result.validatorAddress, wallet.address);
  assert.equal(result.allocatorAddress, ExtensionProofAllocator);
  assert.equal(result.publicFieldsHash, record.publicDataHash);
  assert.equal(result.validatorSignature, signature);
  assert.deepEqual(result.publicFields, [{ key: 'name', value: 'Alice' }]);
  assert.equal('result' in result, false);
  assert.equal('data' in result, false);
  assert.equal('zkpResponse' in result, false);
  assert.equal(listeners.size, 0);
});
