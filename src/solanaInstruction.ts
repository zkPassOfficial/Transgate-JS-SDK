export const SolanaTask = {
  struct: {
    task: 'string',
    schema: 'string',
    notary: 'string',
  },
}

export const Attest = {
  struct: {
    task: 'string',
    schema: 'string',
    nullifier: 'string',
    recipient: 'string',
    publicFieldsHash: 'string'
  } 
}
