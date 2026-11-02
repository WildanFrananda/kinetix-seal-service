type CredentialRecord = {
  id: string
  principalId: string
  classId: Uint8Array
  attributes: bigint[]
  salt: Uint8Array
  holderPublicKey: bigint
  issueDay: number
  requestedAt: Date
}

export type { CredentialRecord }
