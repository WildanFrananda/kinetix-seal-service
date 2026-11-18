import type { CaseStatusFilter } from "../../types/case_status_filter.type.ts"
import type { StoredCaseAggregate } from "../../types/stored_case_aggregate.type.ts"
import type { StoredCaseDetail } from "../../types/stored_case_detail.type.ts"

interface CaseStorePort {
  listCases(status: CaseStatusFilter): Promise<StoredCaseAggregate[]>
  resolveMerchants(merchantTags: readonly string[]): Promise<ReadonlyMap<string, string>>
  findCase(merchantTag: string, status: CaseStatusFilter): Promise<StoredCaseDetail | undefined>
}

export type { CaseStorePort }
