import { Counter, type Registry } from "prom-client"

import type { CredentialMetricsPort } from "../../application/ports/credential_metrics.port.ts"
import type { CredentialRequestKind } from "../../types/credential_request_kind.type.ts"
import type { IssuanceOutcome } from "../../types/issuance_outcome.type.ts"

const requestOutcomes: readonly CredentialRequestKind[] = [
  "accepted",
  "existing",
  "not_a_courier",
  "facts_stale",
  "no_deliveries",
  "issued_today"
]
const issuanceOutcomes: readonly IssuanceOutcome[] = ["issued", "failed"]

class PrometheusCredentialMetrics implements CredentialMetricsPort {
  private readonly requests: Counter<"outcome">
  private readonly issuances: Counter<"outcome">

  constructor(registry: Registry) {
    this.requests = new Counter({
      name: "kinetix_seal_credential_requests_total",
      help: "Courier credential requests, by outcome",
      labelNames: ["outcome"],
      registers: [registry]
    })
    this.issuances = new Counter({
      name: "kinetix_seal_credential_issuances_total",
      help: "Credential issue transactions, by outcome",
      labelNames: ["outcome"],
      registers: [registry]
    })

    for (const outcome of requestOutcomes) {
      this.requests.inc({ outcome }, 0)
    }

    for (const outcome of issuanceOutcomes) {
      this.issuances.inc({ outcome }, 0)
    }
  }

  requested(outcome: CredentialRequestKind): void {
    this.requests.inc({ outcome })
  }

  issued(outcome: IssuanceOutcome): void {
    this.issuances.inc({ outcome })
  }
}

export default PrometheusCredentialMetrics
