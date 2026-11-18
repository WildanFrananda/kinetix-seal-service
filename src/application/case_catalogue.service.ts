import { hexOf } from "../domain/hex.ts"
import { merchantTagOf } from "../domain/merchant_tag.ts"
import type { CallerPrincipal } from "../types/caller_principal.type.ts"
import type { CaseCatalogueDependencies } from "../types/case_catalogue_dependencies.type.ts"
import type { CaseDetail } from "../types/case_detail.type.ts"
import type { CaseDetailOutcome } from "../types/case_detail_outcome.type.ts"
import type { CaseListOutcome } from "../types/case_list_outcome.type.ts"
import type { CaseStatusFilter } from "../types/case_status_filter.type.ts"
import type { CaseSummary } from "../types/case_summary.type.ts"
import type { MerchantInfo } from "../types/merchant_info.type.ts"
import type { StoredCaseAggregate } from "../types/stored_case_aggregate.type.ts"

const unknownMerchant: MerchantInfo = {
  storeName: null,
  status: null
}

class CaseCatalogue {
  private readonly dependencies: CaseCatalogueDependencies

  constructor(dependencies: CaseCatalogueDependencies) {
    this.dependencies = dependencies
  }

  async list(caller: CallerPrincipal, status: CaseStatusFilter = "all"): Promise<CaseListOutcome> {
    if (caller.role !== "admin") {
      return { kind: "not_admin" }
    }

    const aggregates = await this.dependencies.cases.listCases(status)

    if (aggregates.length === 0) {
      return { kind: "listed", cases: [] }
    }

    const principals = await this.dependencies.cases.resolveMerchants(aggregates.map((item) => item.merchantTag))
    const resolved = aggregates.flatMap((aggregate) => {
      const principalId = principals.get(aggregate.merchantTag)

      return principalId === undefined ? [] : [{ aggregate, principalId }]
    })

    const profiles = await Promise.all(resolved.map((entry) => this.dependencies.merchants.find(entry.principalId)))

    const cases = resolved
      .map((entry, index) => this.summaryFrom(entry.aggregate, entry.principalId, profiles[index]))
      .sort((left, right) => this.compareSummaries(left, right))

    return { kind: "listed", cases }
  }

  async detail(
    caller: CallerPrincipal,
    merchantPrincipalId: string,
    status: CaseStatusFilter = "all"
  ): Promise<CaseDetailOutcome> {
    if (caller.role !== "admin") {
      return { kind: "not_admin" }
    }

    const merchantTag = hexOf(merchantTagOf(this.dependencies.issuerSecret, merchantPrincipalId))
    const stored = await this.dependencies.cases.findCase(merchantTag, status)

    if (stored === undefined) {
      return { kind: "not_found" }
    }

    const profile = await this.dependencies.merchants.find(merchantPrincipalId)
    const detail: CaseDetail = {
      ...this.summaryFrom(stored, merchantPrincipalId, profile),
      reports: stored.reports
    }

    return { kind: "found", detail }
  }

  private compareSummaries(left: CaseSummary, right: CaseSummary): number {
    const timeDifference = right.latestReportedAt.getTime() - left.latestReportedAt.getTime()

    if (timeDifference !== 0) {
      return timeDifference
    }

    const totalDifference = right.totalCount - left.totalCount

    if (totalDifference !== 0) {
      return totalDifference
    }

    return left.merchantPrincipalId.localeCompare(right.merchantPrincipalId)
  }

  private summaryFrom(
    stored: StoredCaseAggregate,
    merchantPrincipalId: string,
    merchant: MerchantInfo | undefined
  ): CaseSummary {
    return {
      merchantPrincipalId,
      merchantTag: stored.merchantTag,
      merchant: merchant ?? unknownMerchant,
      confirmedCount: stored.confirmedCount,
      pendingCount: stored.pendingCount,
      totalCount: stored.totalCount,
      windowCount: stored.windowCount,
      earliestWindow: stored.earliestWindow,
      latestWindow: stored.latestWindow,
      firstReportedAt: stored.firstReportedAt,
      latestReportedAt: stored.latestReportedAt,
      categories: stored.categories
    }
  }
}

export default CaseCatalogue
