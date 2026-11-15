import { isReportBodyValid, reportDigestOf } from "../domain/report_digest.ts"
import { matchingReportCall } from "../domain/report_shape.ts"
import type { ReportCategory } from "../types/report_category.type.ts"
import type { ReportStatusView } from "../types/report_status_view.type.ts"
import type { ReportSubmissionOutcome } from "../types/report_submission_outcome.type.ts"
import type { ReportSubmissionsDependencies } from "../types/report_submissions_dependencies.type.ts"
import type { SubmitReportInput } from "../types/submit_report_input.type.ts"
import type { FiledReportStorePort } from "./ports/filed_report_store.port.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"
import type { ReportCategoryStorePort } from "./ports/report_category_store.port.ts"
import type { ReportChainPort } from "./ports/report_chain.port.ts"
import type { ReportInspectorPort } from "./ports/report_inspector.port.ts"
import type { ReportMetricsPort } from "./ports/report_metrics.port.ts"
import type { TransactionPayerPort } from "./ports/transaction_payer.port.ts"

const hex32Pattern = /^[0-9a-f]{64}$/i

function parseHex32(value: string): Uint8Array | undefined {
  if (!hex32Pattern.test(value)) {
    return undefined
  }

  return new Uint8Array(Buffer.from(value, "hex"))
}

class ReportSubmissions {
  private readonly categories: ReportCategoryStorePort
  private readonly generations: RegistryGenerationStorePort
  private readonly reports: FiledReportStorePort
  private readonly inspector: ReportInspectorPort
  private readonly chain: ReportChainPort
  private readonly payer: TransactionPayerPort
  private readonly metrics: ReportMetricsPort
  private readonly logger: LoggerPort
  private readonly minimumHolders: number

  constructor(dependencies: ReportSubmissionsDependencies) {
    this.categories = dependencies.categories
    this.generations = dependencies.generations
    this.reports = dependencies.reports
    this.inspector = dependencies.inspector
    this.chain = dependencies.chain
    this.payer = dependencies.payer
    this.metrics = dependencies.metrics
    this.logger = dependencies.logger
    this.minimumHolders = dependencies.minimumHolders
  }

  async activeCategories(): Promise<ReportCategory[]> {
    return this.categories.listActive()
  }

  async statusOf(nullifier: string): Promise<ReportStatusView | undefined> {
    if (!hex32Pattern.test(nullifier)) {
      return undefined
    }

    const row = await this.reports.findByNullifier(nullifier.toLowerCase())

    if (row === undefined) {
      return undefined
    }

    return {
      nullifier: row.nullifier,
      status: row.status,
      generation: row.firstGeneration,
      txId: row.txId,
      submittedAt: row.submittedAt,
      confirmedAt: row.confirmedAt
    }
  }

  async submit(input: SubmitReportInput, now: Date = new Date()): Promise<ReportSubmissionOutcome> {
    const category = await this.categories.findActive(input.category)

    if (category === undefined) {
      return this.fail({ kind: "unknown_category" })
    }

    if (!isReportBodyValid(input.body)) {
      return this.fail({ kind: "invalid_body" })
    }

    const saltBytes = parseHex32(input.salt)

    if (saltBytes === undefined) {
      return this.fail({ kind: "invalid_salt" })
    }

    const active = (await this.generations.unretired()).find((generation) => generation.status === "active")

    if (active === undefined) {
      return this.fail({ kind: "registry_unavailable" })
    }

    const inspected = this.inspector.inspect(input.transaction)
    const firstCall = inspected?.calls[0]

    if (
      inspected === undefined ||
      inspected.offers !== 0 ||
      inspected.otherActions !== 0 ||
      inspected.calls.length !== 1 ||
      firstCall === undefined ||
      firstCall.entryPoint !== "report" ||
      firstCall.address.toLowerCase() !== active.contractAddress.toLowerCase()
    ) {
      return this.fail({ kind: "not_a_report" })
    }

    const expectedDigest = reportDigestOf(category.slug, input.body, saltBytes)
    const call = matchingReportCall(inspected, active.contractAddress, expectedDigest)

    if (call === undefined) {
      return this.fail({ kind: "digest_mismatch" })
    }

    const nullifier = Buffer.from(call.nullifier).toString("hex")
    const merchantTag = Buffer.from(call.merchantTag).toString("hex")
    const digest = Buffer.from(call.digest).toString("hex")

    if ((await this.reports.findByNullifier(nullifier)) !== undefined) {
      return this.fail({ kind: "already_reported" })
    }

    const holders = await this.reports.grantedHoldersCount(active.generation, merchantTag, call.window)

    if (holders < this.minimumHolders) {
      return this.fail({ kind: "crowd_too_small", holders, minimum: this.minimumHolders })
    }

    let onChainExists = false

    try {
      onChainExists = await this.chain.hasReport(active.contractAddress, call.nullifier)
    } catch {
      this.logger.warn({ message: "the report registry could not be queried before sponsoring" })
      return this.fail({ kind: "registry_unavailable" })
    }

    if (onChainExists) {
      return this.fail({ kind: "already_reported" })
    }

    let txId = ""

    try {
      txId = await this.payer.sponsor(input.transaction)
    } catch {
      this.logger.warn({ message: `sponsoring a filed report in generation ${active.generation} failed` })
      return this.fail({ kind: "sponsor_unavailable" })
    }

    const inserted = await this.reports.insertSubmitted({
      nullifier,
      categorySlug: category.slug,
      body: input.body,
      salt: input.salt.toLowerCase(),
      digest,
      merchantTag,
      window: call.window,
      status: "submitted",
      firstGeneration: active.generation,
      txId,
      submittedAt: now,
      confirmedAt: undefined
    })

    if (!inserted) {
      return this.fail({ kind: "already_reported" })
    }

    this.metrics.reportSubmitted("accepted")

    return {
      kind: "accepted",
      nullifier,
      txId,
      status: "submitted"
    }
  }

  private fail(outcome: Exclude<ReportSubmissionOutcome, { kind: "accepted" }>): ReportSubmissionOutcome {
    this.metrics.reportSubmitted(outcome.kind)
    return outcome
  }
}

export default ReportSubmissions
