import type { RelayOutcomeKind } from "../../types/relay_outcome_kind.type.ts"

interface PresentationMetricsPort {
  relayed(outcome: RelayOutcomeKind): void
}

export type { PresentationMetricsPort }
