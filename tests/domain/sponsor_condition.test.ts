import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { sponsorConditionOf } from "../../src/domain/sponsor_condition.ts"
import { snapshot } from "../fakes/snapshot.ts"

const thresholds = { minimumDustCoins: 3, minimumDust: 100n * 1_000_000_000_000_000n }

describe("the sponsor's condition", () => {
  it("is syncing until the wallet has caught up, whatever it holds", () => {
    assert.equal(sponsorConditionOf(snapshot({ synced: false }), thresholds), "syncing")
  })

  it("is healthy with enough coins and enough DUST", () => {
    assert.equal(sponsorConditionOf(snapshot({}), thresholds), "healthy")
  })

  it("is low on DUST with fewer coins than the minimum", () => {
    assert.equal(sponsorConditionOf(snapshot({ dustCoins: 2 }), thresholds), "low_dust")
  })

  it("is low on DUST below the minimum balance", () => {
    assert.equal(sponsorConditionOf(snapshot({ dustBalance: 99n * 1_000_000_000_000_000n }), thresholds), "low_dust")
  })

  it("has no DUST when every coin is gone, as after a rejected spend", () => {
    assert.equal(sponsorConditionOf(snapshot({ dustCoins: 0, dustBalance: 0n }), thresholds), "no_dust")
  })
})
