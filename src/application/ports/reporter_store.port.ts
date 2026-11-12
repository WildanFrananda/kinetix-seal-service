import type { ReporterRecord } from "../../types/reporter_record.type.ts"

interface ReporterStorePort {
  byKey(reporterKey: bigint): Promise<ReporterRecord | undefined>
  record(reporter: ReporterRecord): Promise<"recorded" | "conflict">
}

export type { ReporterStorePort }
