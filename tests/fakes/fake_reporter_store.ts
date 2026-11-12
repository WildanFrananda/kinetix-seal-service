import type { ReporterStorePort } from "../../src/application/ports/reporter_store.port.ts"
import type { ReporterRecord } from "../../src/types/reporter_record.type.ts"

class FakeReporterStore implements ReporterStorePort {
  readonly rows: ReporterRecord[] = []
  racedBy: ReporterRecord | undefined

  async byKey(reporterKey: bigint): Promise<ReporterRecord | undefined> {
    return this.rows.find((row) => row.reporterKey === reporterKey)
  }

  async record(reporter: ReporterRecord): Promise<"recorded" | "conflict"> {
    if (this.racedBy !== undefined) {
      this.rows.push(this.racedBy)
      this.racedBy = undefined

      return "conflict"
    }

    if (this.rows.some((row) => row.reporterKey === reporter.reporterKey)) {
      return "conflict"
    }

    this.rows.push(reporter)

    return "recorded"
  }
}

export default FakeReporterStore
