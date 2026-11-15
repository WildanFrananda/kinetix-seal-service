import { Counter, type Registry } from "prom-client"

import type { ReportMetricsPort } from "../../application/ports/report_metrics.port.ts"
import type { ReportSubmissionOutcome } from "../../types/report_submission_outcome.type.ts"
import type { ReporterRegistrationOutcome } from "../../types/reporter_registration_outcome.type.ts"

const registrationOutcomes: readonly ReporterRegistrationOutcome["kind"][] = [
  "registered",
  "existing",
  "not_a_reporter",
  "key_taken"
]

const grantOutcomes: readonly ("granted" | "failed")[] = ["granted", "failed"]

const submissionOutcomes: readonly (ReportSubmissionOutcome["kind"] | "rate_limited")[] = [
  "accepted",
  "unknown_category",
  "invalid_body",
  "invalid_salt",
  "digest_mismatch",
  "registry_unavailable",
  "not_a_report",
  "already_reported",
  "crowd_too_small",
  "sponsor_unavailable",
  "rate_limited"
]

const seedOutcomes: readonly ("seeded" | "failed")[] = ["seeded", "failed"]

class PrometheusReportMetrics implements ReportMetricsPort {
  private readonly registrations: Counter<"outcome">
  private readonly grants: Counter<"outcome">
  private readonly rights: Counter
  private readonly submissions: Counter<"outcome">
  private readonly confirmations: Counter
  private readonly seeds: Counter<"outcome">

  constructor(registry: Registry) {
    this.registrations = new Counter({
      name: "kinetix_seal_reporter_registrations_total",
      help: "Reporter key registrations, by outcome",
      labelNames: ["outcome"],
      registers: [registry]
    })

    this.grants = new Counter({
      name: "kinetix_seal_report_grants_total",
      help: "Report right grant transactions, by outcome",
      labelNames: ["outcome"],
      registers: [registry]
    })

    this.rights = new Counter({
      name: "kinetix_seal_report_rights_added_total",
      help: "Report rights seal added for registered reporters' delivered orders",
      registers: [registry]
    })

    this.submissions = new Counter({
      name: "kinetix_seal_report_submissions_total",
      help: "Verified anonymous report submissions, by outcome",
      labelNames: ["outcome"],
      registers: [registry]
    })

    this.confirmations = new Counter({
      name: "kinetix_seal_report_confirmations_total",
      help: "Anonymous reports confirmed in the report registry on Midnight",
      registers: [registry]
    })

    this.seeds = new Counter({
      name: "kinetix_seal_report_seeds_total",
      help: "Confirmed reports carried over into a newer report registry generation, by outcome",
      labelNames: ["outcome"],
      registers: [registry]
    })

    for (const outcome of registrationOutcomes) {
      this.registrations.inc({ outcome }, 0)
    }

    for (const outcome of grantOutcomes) {
      this.grants.inc({ outcome }, 0)
    }

    for (const outcome of submissionOutcomes) {
      this.submissions.inc({ outcome }, 0)
    }

    for (const outcome of seedOutcomes) {
      this.seeds.inc({ outcome }, 0)
    }

    this.rights.inc(0)
    this.confirmations.inc(0)
  }

  registered(outcome: ReporterRegistrationOutcome["kind"]): void {
    this.registrations.inc({ outcome })
  }

  granted(outcome: "granted" | "failed"): void {
    this.grants.inc({ outcome })
  }

  rightsAdded(count: number): void {
    this.rights.inc(count)
  }

  reportSubmitted(outcome: ReportSubmissionOutcome["kind"] | "rate_limited"): void {
    this.submissions.inc({ outcome })
  }

  reportConfirmed(): void {
    this.confirmations.inc()
  }

  reportSeeded(outcome: "seeded" | "failed"): void {
    this.seeds.inc({ outcome })
  }
}

export default PrometheusReportMetrics
