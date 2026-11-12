import type { ReporterRegistrationOutcome } from "../../types/reporter_registration_outcome.type.ts"

interface ReportMetricsPort {
  registered(outcome: ReporterRegistrationOutcome["kind"]): void
  granted(outcome: "granted" | "failed"): void
  rightsAdded(count: number): void
}

export type { ReportMetricsPort }
