import type { SponsorCondition } from "../../types/sponsor_condition.type.ts"
import type { SponsorSnapshot } from "../../types/sponsor_snapshot.type.ts"

interface SponsorGaugesPort {
  observe(snapshot: SponsorSnapshot, condition: SponsorCondition): void
}

export type { SponsorGaugesPort }
