import type { SponsorSnapshot } from "../../src/types/sponsor_snapshot.type.ts"

function snapshot(overrides: Partial<SponsorSnapshot>): SponsorSnapshot {
  return {
    synced: true,
    dustBalance: 3_000n * 1_000_000_000_000_000n,
    dustCoins: 10,
    nightUtxos: 10,
    observedAt: new Date("2026-10-22T00:00:00Z"),
    ...overrides
  }
}

export { snapshot }
