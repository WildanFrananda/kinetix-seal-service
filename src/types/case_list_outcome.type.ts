import type { CaseSummary } from "./case_summary.type.ts"

type CaseListOutcome =
  | {
      kind: "listed"
      cases: CaseSummary[]
    }
  | {
      kind: "not_admin"
    }

export type { CaseListOutcome }
