import type { IssuanceStatus } from "./issuance_status.type.ts"

type IssuanceRecord = {
  credentialId: string
  generation: number
  status: IssuanceStatus
  leaf: Uint8Array | undefined
  leafIndex: bigint | undefined
  txId: string | undefined
}

export type { IssuanceRecord }
