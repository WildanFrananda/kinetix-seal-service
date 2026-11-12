import type { ReporterRole } from "./reporter_role.type.ts"

type RightCandidate = {
  reporterId: string
  reporterKey: bigint
  principalId: string
  role: ReporterRole
  orderNumber: string
  merchantPrincipalId: string
  deliveredAt: Date
}

export type { RightCandidate }
