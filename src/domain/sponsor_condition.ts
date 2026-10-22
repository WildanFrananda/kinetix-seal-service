import type { SponsorCondition } from "../types/sponsor_condition.type.ts"
import type { SponsorSnapshot } from "../types/sponsor_snapshot.type.ts"
import type { SponsorThresholds } from "../types/sponsor_thresholds.type.ts"

function sponsorConditionOf(snapshot: SponsorSnapshot, thresholds: SponsorThresholds): SponsorCondition {
  if (!snapshot.synced) {
    return "syncing"
  }

  if (snapshot.dustCoins === 0 || snapshot.dustBalance === 0n) {
    return "no_dust"
  }

  if (snapshot.dustCoins < thresholds.minimumDustCoins || snapshot.dustBalance < thresholds.minimumDust) {
    return "low_dust"
  }

  return "healthy"
}

export { sponsorConditionOf }
