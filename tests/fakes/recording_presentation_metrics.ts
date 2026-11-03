import type { PresentationMetricsPort } from "../../src/application/ports/presentation_metrics.port.ts"
import type { RelayOutcomeKind } from "../../src/types/relay_outcome_kind.type.ts"

class RecordingPresentationMetrics implements PresentationMetricsPort {
  readonly outcomes: RelayOutcomeKind[] = []

  relayed(outcome: RelayOutcomeKind): void {
    this.outcomes.push(outcome)
  }
}

export default RecordingPresentationMetrics
