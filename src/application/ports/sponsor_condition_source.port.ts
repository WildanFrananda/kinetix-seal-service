import type { RemoteSponsorCondition } from "../../types/remote_sponsor_condition.type.ts"

interface SponsorConditionSourcePort {
  condition(): RemoteSponsorCondition
}

export type { SponsorConditionSourcePort }
