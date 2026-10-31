import type { SponsorConditionSourcePort } from "../../src/application/ports/sponsor_condition_source.port.ts"
import type { RemoteSponsorCondition } from "../../src/types/remote_sponsor_condition.type.ts"

class FixedSponsorCondition implements SponsorConditionSourcePort {
  current: RemoteSponsorCondition

  constructor(current: RemoteSponsorCondition) {
    this.current = current
  }

  condition(): RemoteSponsorCondition {
    return this.current
  }
}

export default FixedSponsorCondition
