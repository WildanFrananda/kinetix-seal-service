import type { SponsorCondition } from "./sponsor_condition.type.ts"

type SponsorEvent = {
  occurredAt: Date
  condition: SponsorCondition
  dustBalance: bigint
  dustCoins: number
  nightUtxos: number
}

export type { SponsorEvent }
