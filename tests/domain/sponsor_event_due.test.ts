import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isSponsorEventDue } from "../../src/domain/sponsor_event_due.ts"
import type { SponsorEvent } from "../../src/types/sponsor_event.type.ts"

const previous: SponsorEvent = {
  occurredAt: new Date("2026-10-22T00:00:00Z"),
  condition: "healthy",
  dustBalance: 1n,
  dustCoins: 10,
  nightUtxos: 10
}

describe("whether the sponsor's change is recorded", () => {
  it("records the first observation", () => {
    assert.equal(isSponsorEventDue(undefined, "syncing", 0, 0), true)
  })

  it("records a change of condition", () => {
    assert.equal(isSponsorEventDue(previous, "low_dust", 10, 10), true)
  })

  it("records a lost DUST coin even when the condition holds", () => {
    assert.equal(isSponsorEventDue(previous, "healthy", 9, 10), true)
  })

  it("does not record a balance that only grew", () => {
    assert.equal(isSponsorEventDue(previous, "healthy", 10, 10), false)
  })
})
