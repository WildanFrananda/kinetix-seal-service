import type { CaseCategoryTally } from "./case_category_tally.type.ts"

type StoredCaseAggregate = {
  merchantTag: string
  confirmedCount: number
  pendingCount: number
  totalCount: number
  windowCount: number
  earliestWindow: number
  latestWindow: number
  firstReportedAt: Date
  latestReportedAt: Date
  categories: CaseCategoryTally[]
}

export type { StoredCaseAggregate }
