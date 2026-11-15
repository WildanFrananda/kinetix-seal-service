import type { FiledReportRecord } from "../../types/filed_report_record.type.ts"
import type { UnsettledReportSeed } from "../../types/unsettled_report_seed.type.ts"

interface FiledReportStorePort {
  grantedHoldersCount(generation: number, merchantTag: string, window: bigint): Promise<number>
  findByNullifier(nullifier: string): Promise<FiledReportRecord | undefined>
  insertSubmitted(report: FiledReportRecord): Promise<boolean>
  unconfirmedSubmitted(limit: number): Promise<FiledReportRecord[]>
  markConfirmed(nullifier: string, confirmedAt: Date): Promise<void>
  queueMissingSeeds(generation: number, at: Date): Promise<number>
  nextUnsettledSeed(generation: number): Promise<UnsettledReportSeed | undefined>
  markSeedUncertain(nullifier: string, generation: number, at: Date): Promise<void>
  markSeeded(nullifier: string, generation: number, txId: string | undefined, at: Date): Promise<void>
}

export type { FiledReportStorePort }
