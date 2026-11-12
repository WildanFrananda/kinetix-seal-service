import type { ReportMetricsPort } from "../../src/application/ports/report_metrics.port.ts"
import type { ReporterRegistrationOutcome } from "../../src/types/reporter_registration_outcome.type.ts"

class RecordingReportMetrics implements ReportMetricsPort {
  readonly registrations: ReporterRegistrationOutcome["kind"][] = []
  readonly grants: ("granted" | "failed")[] = []
  added = 0

  registered(outcome: ReporterRegistrationOutcome["kind"]): void {
    this.registrations.push(outcome)
  }

  granted(outcome: "granted" | "failed"): void {
    this.grants.push(outcome)
  }

  rightsAdded(count: number): void {
    this.added += count
  }
}

export default RecordingReportMetrics
