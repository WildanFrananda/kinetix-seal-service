import type { CaseStorePort } from "../../src/application/ports/case_store.port.ts"
import type { CaseStatusFilter } from "../../src/types/case_status_filter.type.ts"
import type { StoredCaseAggregate } from "../../src/types/stored_case_aggregate.type.ts"
import type { StoredCaseDetail } from "../../src/types/stored_case_detail.type.ts"

class FakeCaseStore implements CaseStorePort {
  readonly details = new Map<string, StoredCaseDetail>()
  readonly tags = new Map<string, string>()

  async listCases(status: CaseStatusFilter): Promise<StoredCaseAggregate[]> {
    const items = [...this.details.values()].filter((detail) => {
      if (status === "confirmed") {
        return detail.confirmedCount > 0
      }

      if (status === "submitted") {
        return detail.pendingCount > 0
      }

      return true
    })

    return items.map(({ reports: _reports, ...aggregate }) => aggregate)
  }

  async resolveMerchants(merchantTags: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const map = new Map<string, string>()

    for (const tag of merchantTags) {
      const principalId = this.tags.get(tag)

      if (principalId !== undefined) {
        map.set(tag, principalId)
      }
    }

    return map
  }

  async findCase(merchantTag: string, status: CaseStatusFilter): Promise<StoredCaseDetail | undefined> {
    const detail = this.details.get(merchantTag)

    if (detail === undefined) {
      return undefined
    }

    const reports = status === "all" ? detail.reports : detail.reports.filter((report) => report.status === status)

    return { ...detail, reports }
  }
}

export default FakeCaseStore
