import type { CaseReport } from "./case_report.type.ts"
import type { StoredCaseAggregate } from "./stored_case_aggregate.type.ts"

type StoredCaseDetail = StoredCaseAggregate & {
  reports: CaseReport[]
}

export type { StoredCaseDetail }
