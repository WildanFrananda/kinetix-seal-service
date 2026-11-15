import type { ReportMetricsPort } from "../../src/application/ports/report_metrics.port.ts"
import type { ReportSubmissionOutcome } from "../../src/types/report_submission_outcome.type.ts"
import type { ReporterRegistrationOutcome } from "../../src/types/reporter_registration_outcome.type.ts"

class RecordingReportMetrics implements ReportMetricsPort {
  readonly registrations: ReporterRegistrationOutcome["kind"][] = []
  readonly grants: ("granted" | "failed")[] = []
  readonly submissions: (ReportSubmissionOutcome["kind"] | "rate_limited")[] = []
  readonly seeds: ("seeded" | "failed")[] = []
  added = 0
  confirmed = 0

  registered(outcome: ReporterRegistrationOutcome["kind"]): void {
    this.registrations.push(outcome)
  }

  granted(outcome: "granted" | "failed"): void {
    this.grants.push(outcome)
  }

  rightsAdded(count: number): void {
    this.added += count
  }

  reportSubmitted(outcome: ReportSubmissionOutcome["kind"] | "rate_limited"): void {
    this.submissions.push(outcome)
  }

  reportConfirmed(): void {
    this.confirmed += 1
  }

  reportSeeded(outcome: "seeded" | "failed"): void {
    this.seeds.push(outcome)
  }
}

export default RecordingReportMetrics
