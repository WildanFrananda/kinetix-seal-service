import type { ReporterRole } from "./reporter_role.type.ts"

type ReportRight = {
  id: string
  reporterId: string
  principalId: string
  role: ReporterRole
  orderNumber: string
  merchantTag: Uint8Array
  window: number
  leaf: Uint8Array
  createdAt: Date
}

export type { ReportRight }
