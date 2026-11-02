import type { CredentialMetricsPort } from "../../src/application/ports/credential_metrics.port.ts"
import type { CredentialRequestKind } from "../../src/types/credential_request_kind.type.ts"
import type { IssuanceOutcome } from "../../src/types/issuance_outcome.type.ts"

class RecordingCredentialMetrics implements CredentialMetricsPort {
  readonly requests: CredentialRequestKind[] = []
  readonly issuances: IssuanceOutcome[] = []

  requested(outcome: CredentialRequestKind): void {
    this.requests.push(outcome)
  }

  issued(outcome: IssuanceOutcome): void {
    this.issuances.push(outcome)
  }
}

export default RecordingCredentialMetrics
