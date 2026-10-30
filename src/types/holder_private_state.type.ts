import type { Credential } from "#contracts/credential_registry/contract/index.js"

type HolderPrivateState = {
  role: "holder"
  holderSecret: Uint8Array
  credential: Credential
  leafIndex: bigint
}

export type { HolderPrivateState }
