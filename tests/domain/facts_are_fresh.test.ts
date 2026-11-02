import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { factsAreFresh } from "../../src/domain/facts_are_fresh.ts"

const at = new Date("2026-11-02T03:00:00Z")

function secondsBefore(seconds: number): Date {
  return new Date(at.getTime() - seconds * 1000)
}

describe("the freshness of the courier facts", () => {
  it("is fresh when both feeds caught up within the limit", () => {
    assert.equal(factsAreFresh({ deliveries: secondsBefore(30), reviews: secondsBefore(300) }, at, 300), true)
  })

  it("is stale when either feed caught up too long ago", () => {
    assert.equal(factsAreFresh({ deliveries: secondsBefore(30), reviews: secondsBefore(301) }, at, 300), false)
  })

  it("is stale when a feed never caught up", () => {
    assert.equal(factsAreFresh({ deliveries: secondsBefore(1), reviews: undefined }, at, 300), false)
  })
})
