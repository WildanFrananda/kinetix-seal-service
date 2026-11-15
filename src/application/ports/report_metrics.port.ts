import type { ReportSubmissionOutcome } from "../../types/report_submission_outcome.type.ts"
import type { ReporterRegistrationOutcome } from "../../types/reporter_registration_outcome.type.ts"

interface ReportMetricsPort {
  registered(outcome: ReporterRegistrationOutcome["kind"]): void
  granted(outcome: "granted" | "failed"): void
  rightsAdded(count: number): void
  reportSubmitted(outcome: ReportSubmissionOutcome["kind"] | "rate_limited"): void
  reportConfirmed(): void
  reportSeeded(outcome: "seeded" | "failed"): void
}

export type { ReportMetricsPort }
