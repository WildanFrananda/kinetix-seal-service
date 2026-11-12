import type { ReporterRole } from "./reporter_role.type.ts"

type HeldRight = {
  id: string
  role: ReporterRole
  orderNumber: string
  reporterKey: bigint
  merchantTag: Uint8Array
  window: number
  deliveredAt: Date
  leafIndex: bigint | undefined
  crowd: number
}

export type { HeldRight }
