import type { CaseDetail } from "./case_detail.type.ts"

type CaseDetailOutcome =
  | {
      kind: "found"
      detail: CaseDetail
    }
  | {
      kind: "not_admin"
    }
  | {
      kind: "not_found"
    }

export type { CaseDetailOutcome }
