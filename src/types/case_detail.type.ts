import type { CaseReport } from "./case_report.type.ts"
import type { CaseSummary } from "./case_summary.type.ts"

type CaseDetail = CaseSummary & {
  reports: CaseReport[]
}

export type { CaseDetail }
