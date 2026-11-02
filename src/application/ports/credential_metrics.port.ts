import type { CredentialRequestKind } from "../../types/credential_request_kind.type.ts"
import type { IssuanceOutcome } from "../../types/issuance_outcome.type.ts"

interface CredentialMetricsPort {
  requested(outcome: CredentialRequestKind): void
  issued(outcome: IssuanceOutcome): void
}

export type { CredentialMetricsPort }
