import type { SponsorCondition } from "../types/sponsor_condition.type.ts"
import type { SponsorEvent } from "../types/sponsor_event.type.ts"

function isSponsorEventDue(
  previous: SponsorEvent | undefined,
  condition: SponsorCondition,
  dustCoins: number,
  nightUtxos: number
): boolean {
  if (previous === undefined) {
    return true
  }

  return previous.condition !== condition || previous.dustCoins !== dustCoins || previous.nightUtxos !== nightUtxos
}

export { isSponsorEventDue }
