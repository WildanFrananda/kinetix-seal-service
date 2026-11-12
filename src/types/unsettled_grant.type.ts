import type { ReportRight } from "./report_right.type.ts"
import type { RightGrantStatus } from "./right_grant_status.type.ts"

type UnsettledGrant = {
  right: ReportRight
  status: Exclude<RightGrantStatus, "granted">
}

export type { UnsettledGrant }
