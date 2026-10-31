import type { SponsorCondition } from "./sponsor_condition.type.ts"
import type { SponsorSnapshot } from "./sponsor_snapshot.type.ts"

type SponsorState = {
  condition: SponsorCondition
  snapshot: SponsorSnapshot
}

export type { SponsorState }
