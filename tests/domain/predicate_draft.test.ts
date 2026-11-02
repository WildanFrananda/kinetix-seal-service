import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { courierClass } from "../../src/domain/credential_classes.ts"
import { draftPredicate } from "../../src/domain/predicate_draft.ts"

describe("drafting a predicate", () => {
  it("keeps a label, minimums within the class's bounds and a freshness window", () => {
    assert.deepEqual(draftPredicate(courierClass, "  Experienced courier ", [100n, 450n, 90n], 30), {
      classId: courierClass.id,
      label: "Experienced courier",
      minimums: [100n, 450n, 90n],
      freshnessDays: 30
    })
  })

  it("allows minimums of zero, and each class's own ceilings", () => {
    assert.ok(draftPredicate(courierClass, "Any recent courier", [0n, 0n, 0n], 365))
    assert.ok(draftPredicate(courierClass, "Top", [1_000_000n, 500n, 36_525n], 1))
  })

  it("refuses minimums past a ceiling, below zero or of the wrong count", () => {
    for (const minimums of [
      [0n, 501n, 0n],
      [-1n, 0n, 0n],
      [0n, 0n],
      [0n, 0n, 0n, 0n]
    ]) {
      assert.equal(draftPredicate(courierClass, "label", minimums, 30), undefined, minimums.join())
    }
  })

  it("refuses a freshness window outside one day to a year", () => {
    for (const freshnessDays of [0, 366, 1.5]) {
      assert.equal(draftPredicate(courierClass, "label", [0n, 0n, 0n], freshnessDays), undefined, String(freshnessDays))
    }
  })

  it("refuses an empty, overlong or unprintable label", () => {
    for (const label of ["   ", "x".repeat(81), "line\nbreak", "zero\u200bwidth"]) {
      assert.equal(draftPredicate(courierClass, label, [0n, 0n, 0n], 30), undefined, JSON.stringify(label))
    }

    assert.ok(draftPredicate(courierClass, "é".repeat(80), [0n, 0n, 0n], 30))
  })
})
