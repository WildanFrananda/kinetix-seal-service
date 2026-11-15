import type { FiledReportStorePort } from "../../src/application/ports/filed_report_store.port.ts"
import type { FiledReportRecord } from "../../src/types/filed_report_record.type.ts"
import type { UnsettledReportSeed } from "../../src/types/unsettled_report_seed.type.ts"

type SeedEntry = {
  nullifier: string
  generation: number
  status: "pending" | "uncertain" | "seeded"
  txId: string | undefined
  attempts: number
  queuedAt: Date
  submittedAt: Date | undefined
  seededAt: Date | undefined
}

class FakeFiledReportStore implements FiledReportStorePort {
  readonly reports = new Map<string, FiledReportRecord>()
  readonly seeds = new Map<string, SeedEntry>()
  private readonly holders = new Map<string, number>()

  setHolders(generation: number, merchantTag: string, window: bigint, count: number): void {
    this.holders.set(`${generation}:${merchantTag}:${window}`, count)
  }

  async grantedHoldersCount(generation: number, merchantTag: string, window: bigint): Promise<number> {
    return this.holders.get(`${generation}:${merchantTag}:${window}`) ?? 0
  }

  async findByNullifier(nullifier: string): Promise<FiledReportRecord | undefined> {
    const found = this.reports.get(nullifier)

    return found === undefined ? undefined : { ...found }
  }

  async insertSubmitted(report: FiledReportRecord): Promise<boolean> {
    if (this.reports.has(report.nullifier)) {
      return false
    }

    this.reports.set(report.nullifier, { ...report, status: "submitted", confirmedAt: undefined })

    return true
  }

  async unconfirmedSubmitted(limit: number): Promise<FiledReportRecord[]> {
    return [...this.reports.values()]
      .filter((row) => row.status === "submitted")
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .slice(0, limit)
      .map((row) => ({ ...row }))
  }

  async markConfirmed(nullifier: string, confirmedAt: Date): Promise<void> {
    const existing = this.reports.get(nullifier)

    if (existing !== undefined) {
      existing.status = "confirmed"
      existing.confirmedAt = confirmedAt
    }
  }

  async queueMissingSeeds(generation: number, at: Date): Promise<number> {
    let inserted = 0

    for (const report of this.reports.values()) {
      if (report.status !== "confirmed" || report.firstGeneration === generation) {
        continue
      }

      const key = `${report.nullifier}:${generation}`

      if (this.seeds.has(key)) {
        continue
      }

      this.seeds.set(key, {
        nullifier: report.nullifier,
        generation,
        status: "pending",
        txId: undefined,
        attempts: 0,
        queuedAt: at,
        submittedAt: undefined,
        seededAt: undefined
      })

      inserted += 1
    }

    return inserted
  }

  async nextUnsettledSeed(generation: number): Promise<UnsettledReportSeed | undefined> {
    const matching = [...this.seeds.values()].filter(
      (seed) => seed.generation === generation && seed.status !== "seeded"
    )

    matching.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "uncertain" ? -1 : 1
      }

      return a.queuedAt.getTime() - b.queuedAt.getTime()
    })

    const next = matching[0]

    if (next === undefined) {
      return undefined
    }

    const report = this.reports.get(next.nullifier)

    if (report === undefined) {
      return undefined
    }

    return {
      nullifier: next.nullifier,
      generation: next.generation,
      status: next.status === "uncertain" ? "uncertain" : "pending",
      attempts: next.attempts,
      merchantTag: report.merchantTag,
      window: report.window,
      digest: report.digest
    }
  }

  async markSeedUncertain(nullifier: string, generation: number, at: Date): Promise<void> {
    const seed = this.seeds.get(`${nullifier}:${generation}`)

    if (seed !== undefined) {
      seed.status = "uncertain"
      seed.attempts += 1
      seed.submittedAt = at
    }
  }

  async markSeeded(nullifier: string, generation: number, txId: string | undefined, at: Date): Promise<void> {
    const seed = this.seeds.get(`${nullifier}:${generation}`)

    if (seed !== undefined) {
      seed.status = "seeded"
      seed.txId = txId
      seed.seededAt = at
    }
  }
}

export default FakeFiledReportStore
