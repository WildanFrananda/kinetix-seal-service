import { Counter, type Registry } from "prom-client"

import type { ReportMetricsPort } from "../../application/ports/report_metrics.port.ts"
import type { ReporterRegistrationOutcome } from "../../types/reporter_registration_outcome.type.ts"

const registrationOutcomes: readonly ReporterRegistrationOutcome["kind"][] = [
  "registered",
  "existing",
  "not_a_reporter",
  "key_taken"
]

const grantOutcomes: readonly ("granted" | "failed")[] = ["granted", "failed"]

class PrometheusReportMetrics implements ReportMetricsPort {
  private readonly registrations: Counter<"outcome">
  private readonly grants: Counter<"outcome">
  private readonly rights: Counter

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

    for (const outcome of registrationOutcomes) {
      this.registrations.inc({ outcome }, 0)
    }

    for (const outcome of grantOutcomes) {
      this.grants.inc({ outcome }, 0)
    }

    this.rights.inc(0)
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
}

export default PrometheusReportMetrics
