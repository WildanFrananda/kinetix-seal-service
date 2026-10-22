import type { SponsorCondition } from "../../types/sponsor_condition.type.ts"

interface SponsorConditionSourcePort {
  condition(): SponsorCondition
}

export type { SponsorConditionSourcePort }
