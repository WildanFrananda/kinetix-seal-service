import type { SponsorConditionSourcePort } from "../../src/application/ports/sponsor_condition_source.port.ts"
import type { SponsorCondition } from "../../src/types/sponsor_condition.type.ts"

class FixedSponsorCondition implements SponsorConditionSourcePort {
  current: SponsorCondition

  constructor(current: SponsorCondition) {
    this.current = current
  }

  condition(): SponsorCondition {
    return this.current
  }
}

export default FixedSponsorCondition
