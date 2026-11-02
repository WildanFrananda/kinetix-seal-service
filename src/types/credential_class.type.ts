import type { CredentialThreshold } from "./credential_threshold.type.ts"

type CredentialClass = {
  name: string
  id: Uint8Array
  thresholds: CredentialThreshold[]
}

export type { CredentialClass }
