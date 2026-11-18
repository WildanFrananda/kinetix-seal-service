import type { CaseCategoryTally } from "./case_category_tally.type.ts"
import type { MerchantInfo } from "./merchant_info.type.ts"

type CaseSummary = {
  merchantPrincipalId: string
  merchantTag: string
  merchant: MerchantInfo
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

export type { CaseSummary }
