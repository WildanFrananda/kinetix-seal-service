import type { CredentialStanding } from "./credential_standing.type.ts"

type CredentialView = {
  id: string
  status: CredentialStanding
  issueDay: number
  credential: {
    classId: string
    attributes: string[]
    salt: string
  }
  holderPublicKey: string
  registry: {
    generation: number
    contractAddress: string
    leafIndex: string
    txId: string | null
  } | null
}

export type { CredentialView }
