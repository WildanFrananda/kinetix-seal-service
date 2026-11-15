import type { OnChainFiledReport } from "../types/on_chain_filed_report.type.ts"
import type { ReportKeeperDependencies } from "../types/report_keeper_dependencies.type.ts"
import type { FiledReportStorePort } from "./ports/filed_report_store.port.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"
import type { ReportChainPort } from "./ports/report_chain.port.ts"
import type { ReportMetricsPort } from "./ports/report_metrics.port.ts"

const confirmationBatchSize = 100

class ReportKeeper {
  private readonly generations: RegistryGenerationStorePort
  private readonly reports: FiledReportStorePort
  private readonly chain: ReportChainPort
  private readonly metrics: ReportMetricsPort
  private readonly logger: LoggerPort

  constructor(dependencies: ReportKeeperDependencies) {
    this.generations = dependencies.generations
    this.reports = dependencies.reports
    this.chain = dependencies.chain
    this.metrics = dependencies.metrics
    this.logger = dependencies.logger
  }

  async keep(now: Date = new Date()): Promise<void> {
    const active = (await this.generations.unretired()).find((generation) => generation.status === "active")

    if (active === undefined) {
      return
    }

    await this.confirmSubmitted(active.contractAddress, now)
    await this.reports.queueMissingSeeds(active.generation, now)
    await this.settleSeeds(active.generation, active.contractAddress, now)
  }

  private async confirmSubmitted(contractAddress: string, now: Date): Promise<void> {
    const submitted = await this.reports.unconfirmedSubmitted(confirmationBatchSize)

    if (submitted.length === 0) {
      return
    }

    const onChain = await this.chain.filedReports(contractAddress)
    const byNullifier = new Map<string, OnChainFiledReport>()

    for (const item of onChain) {
      byNullifier.set(Buffer.from(item.nullifier).toString("hex"), item)
    }

    for (const row of submitted) {
      const matched = byNullifier.get(row.nullifier)

      if (matched === undefined) {
        continue
      }

      if (Buffer.from(matched.digest).toString("hex") !== row.digest) {
        continue
      }

      await this.reports.markConfirmed(row.nullifier, now)
      this.metrics.reportConfirmed()
    }
  }

  private async settleSeeds(generation: number, contractAddress: string, now: Date): Promise<void> {
    for (;;) {
      const next = await this.reports.nextUnsettledSeed(generation)

      if (next === undefined) {
        return
      }

      const nullifierBytes = new Uint8Array(Buffer.from(next.nullifier, "hex"))
      const merchantTagBytes = new Uint8Array(Buffer.from(next.merchantTag, "hex"))
      const digestBytes = new Uint8Array(Buffer.from(next.digest, "hex"))

      if (next.status === "uncertain") {
        const present = await this.chain.hasReport(contractAddress, nullifierBytes)

        if (present) {
          await this.reports.markSeeded(next.nullifier, generation, undefined, now)
          this.metrics.reportSeeded("seeded")
          continue
        }
      }

      await this.reports.markSeedUncertain(next.nullifier, generation, now)

      try {
        const receipt = await this.chain.seedReport(contractAddress, {
          nullifier: nullifierBytes,
          merchantTag: merchantTagBytes,
          window: next.window,
          digest: digestBytes
        })

        await this.reports.markSeeded(next.nullifier, generation, receipt.txId, now)
        this.metrics.reportSeeded("seeded")
      } catch {
        this.metrics.reportSeeded("failed")
        this.logger.warn({
          message: `seeding a confirmed report into generation ${generation} failed`
        })

        return
      }
    }
  }
}

export default ReportKeeper
