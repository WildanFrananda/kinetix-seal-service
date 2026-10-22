import type { SponsorGaugesPort } from "../../src/application/ports/sponsor_gauges.port.ts"
import type { SponsorCondition } from "../../src/types/sponsor_condition.type.ts"
import type { SponsorSnapshot } from "../../src/types/sponsor_snapshot.type.ts"

class RecordingSponsorGauges implements SponsorGaugesPort {
  readonly observed: SponsorCondition[] = []

  observe(_snapshot: SponsorSnapshot, condition: SponsorCondition): void {
    this.observed.push(condition)
  }
}

export default RecordingSponsorGauges
