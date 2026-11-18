import type { CaseStorePort } from "../../application/ports/case_store.port.ts"
import { hexOf } from "../../domain/hex.ts"
import { merchantTagOf } from "../../domain/merchant_tag.ts"
import type { CaseAggregateRow } from "../../types/case_aggregate_row.type.ts"
import type { CaseCategoryRow } from "../../types/case_category_row.type.ts"
import type { CaseCategoryTally } from "../../types/case_category_tally.type.ts"
import type { CaseDetailReportRow } from "../../types/case_detail_report_row.type.ts"
import type { CasePrincipalRow } from "../../types/case_principal_row.type.ts"
import type { CaseReport } from "../../types/case_report.type.ts"
import type { CaseStatusFilter } from "../../types/case_status_filter.type.ts"
import type { CaseTagMappingRow } from "../../types/case_tag_mapping_row.type.ts"
import type { StoredCaseAggregate } from "../../types/stored_case_aggregate.type.ts"
import type { StoredCaseDetail } from "../../types/stored_case_detail.type.ts"
import type { PrismaClient } from "./generated/client.ts"

class PrismaCaseStore implements CaseStorePort {
  private readonly prisma: PrismaClient
  private readonly issuerSecret: Uint8Array

  constructor(prisma: PrismaClient, issuerSecret: Uint8Array) {
    this.prisma = prisma
    this.issuerSecret = issuerSecret
  }

  async listCases(status: CaseStatusFilter): Promise<StoredCaseAggregate[]> {
    const matched = (await this.queryAggregates(null)).filter((row) => this.matchesStatus(row, status))

    if (matched.length === 0) {
      return []
    }

    const categoriesByTag = await this.queryCategoryTallies(matched.map((row) => row.merchant_tag))

    return matched.map((row) => this.aggregateFrom(row, categoriesByTag.get(row.merchant_tag) ?? []))
  }

  async resolveMerchants(merchantTags: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const resolved = new Map<string, string>()

    if (merchantTags.length === 0) {
      return resolved
    }

    const wanted = new Set(merchantTags)
    const viaRights = await this.prisma.$queryRaw<CaseTagMappingRow[]>`
      SELECT DISTINCT
        TRIM(rr.merchant_tag) AS merchant_tag,
        o.merchant_principal_id AS merchant_principal_id
      FROM report_rights AS rr
      INNER JOIN delivered_orders AS o ON o.order_number = rr.order_number
      WHERE TRIM(rr.merchant_tag) = ANY(${[...wanted]}::text[])
    `

    for (const row of viaRights) {
      if (wanted.has(row.merchant_tag) && !resolved.has(row.merchant_tag)) {
        resolved.set(row.merchant_tag, row.merchant_principal_id)
      }
    }

    if (resolved.size === wanted.size) {
      return resolved
    }

    const orders = await this.prisma.$queryRaw<CasePrincipalRow[]>`
      SELECT DISTINCT merchant_principal_id
      FROM delivered_orders
    `

    for (const row of orders) {
      const tag = hexOf(merchantTagOf(this.issuerSecret, row.merchant_principal_id))

      if (wanted.has(tag) && !resolved.has(tag)) {
        resolved.set(tag, row.merchant_principal_id)
      }
    }

    return resolved
  }

  async findCase(merchantTag: string, status: CaseStatusFilter): Promise<StoredCaseDetail | undefined> {
    const aggregateRow = (await this.queryAggregates(merchantTag))[0]

    if (aggregateRow === undefined) {
      return undefined
    }

    const statusValue = status === "all" ? null : status
    const [categoriesByTag, reportRows] = await Promise.all([
      this.queryCategoryTallies([merchantTag]),
      this.prisma.$queryRaw<CaseDetailReportRow[]>`
        SELECT
          fr.nullifier AS nullifier,
          rc.slug AS category_slug,
          rc.label AS category_label,
          fr.body AS body,
          fr."window" AS window,
          fr.status AS status,
          fr.first_generation AS first_generation,
          fr.tx_id AS tx_id,
          fr.submitted_at AS submitted_at,
          fr.confirmed_at AS confirmed_at
        FROM filed_reports AS fr
        INNER JOIN report_categories AS rc ON rc.slug = fr.category_slug
        WHERE fr.merchant_tag = ${merchantTag}
          AND (${statusValue}::text IS NULL OR fr.status = ${statusValue})
        ORDER BY fr.submitted_at DESC, fr.nullifier ASC
      `
    ])

    return {
      ...this.aggregateFrom(aggregateRow, categoriesByTag.get(merchantTag) ?? []),
      reports: reportRows.map((row) => this.reportFrom(row))
    }
  }

  private matchesStatus(row: CaseAggregateRow, status: CaseStatusFilter): boolean {
    if (status === "confirmed") {
      return Number(row.confirmed_count) > 0
    }

    if (status === "submitted") {
      return Number(row.pending_count) > 0
    }

    return true
  }

  private aggregateFrom(row: CaseAggregateRow, categories: CaseCategoryTally[]): StoredCaseAggregate {
    return {
      merchantTag: row.merchant_tag,
      confirmedCount: Number(row.confirmed_count),
      pendingCount: Number(row.pending_count),
      totalCount: Number(row.total_count),
      windowCount: Number(row.window_count),
      earliestWindow: Number(row.earliest_window),
      latestWindow: Number(row.latest_window),
      firstReportedAt: row.first_reported_at,
      latestReportedAt: row.latest_reported_at,
      categories
    }
  }

  private reportFrom(row: CaseDetailReportRow): CaseReport {
    return {
      nullifier: row.nullifier,
      category: {
        slug: row.category_slug,
        label: row.category_label
      },
      body: row.body,
      window: Number(row.window),
      status: row.status === "confirmed" ? "confirmed" : "submitted",
      firstGeneration: row.first_generation,
      txId: row.tx_id ?? undefined,
      submittedAt: row.submitted_at,
      confirmedAt: row.confirmed_at ?? undefined
    }
  }

  private async queryAggregates(merchantTag: string | null): Promise<CaseAggregateRow[]> {
    return this.prisma.$queryRaw<CaseAggregateRow[]>`
      SELECT
        fr.merchant_tag AS merchant_tag,
        COUNT(*) FILTER (WHERE fr.status = 'confirmed') AS confirmed_count,
        COUNT(*) FILTER (WHERE fr.status = 'submitted') AS pending_count,
        COUNT(*) AS total_count,
        COUNT(DISTINCT fr."window") AS window_count,
        MIN(fr."window") AS earliest_window,
        MAX(fr."window") AS latest_window,
        MIN(fr.submitted_at) AS first_reported_at,
        MAX(fr.submitted_at) AS latest_reported_at
      FROM filed_reports AS fr
      WHERE (${merchantTag}::text IS NULL OR fr.merchant_tag = ${merchantTag})
      GROUP BY fr.merchant_tag
      ORDER BY MAX(fr.submitted_at) DESC, COUNT(*) DESC, fr.merchant_tag ASC
    `
  }

  private async queryCategoryTallies(tags: readonly string[]): Promise<Map<string, CaseCategoryTally[]>> {
    const rows = await this.prisma.$queryRaw<CaseCategoryRow[]>`
      SELECT
        fr.merchant_tag AS merchant_tag,
        rc.slug AS slug,
        rc.label AS label,
        COUNT(*) AS count
      FROM filed_reports AS fr
      INNER JOIN report_categories AS rc ON rc.slug = fr.category_slug
      WHERE fr.merchant_tag = ANY(${[...tags]}::text[])
      GROUP BY fr.merchant_tag, rc.slug, rc.label
      ORDER BY COUNT(*) DESC, rc.slug ASC
    `

    const categoriesByTag = new Map<string, CaseCategoryTally[]>()

    for (const row of rows) {
      const list = categoriesByTag.get(row.merchant_tag) ?? []
      list.push({ slug: row.slug, label: row.label, count: Number(row.count) })
      categoriesByTag.set(row.merchant_tag, list)
    }

    return categoriesByTag
  }
}

export default PrismaCaseStore
