import type { ReporterRole } from "./reporter_role.type.ts"

type ReporterRecord = {
  id: string
  principalId: string
  role: ReporterRole
  reporterKey: bigint
  registeredAt: Date
}

export type { ReporterRecord }
