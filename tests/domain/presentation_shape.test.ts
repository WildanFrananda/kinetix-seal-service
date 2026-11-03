import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { presentationFault } from "../../src/domain/presentation_shape.ts"

const present = { address: "02cc", entryPoint: "present" }

describe("the shape of a presentation", () => {
  it("is one present call to the active registry, with no coins", () => {
    assert.equal(presentationFault({ calls: [present], otherActions: 0, offers: 0 }, "02cc"), undefined)
  })

  it("refuses anything else before the sponsor spends on it", () => {
    const faults = [
      presentationFault({ calls: [present], otherActions: 0, offers: 1 }, "02cc"),
      presentationFault({ calls: [present], otherActions: 1, offers: 0 }, "02cc"),
      presentationFault({ calls: [present, present], otherActions: 0, offers: 0 }, "02cc"),
      presentationFault({ calls: [], otherActions: 0, offers: 0 }, "02cc"),
      presentationFault({ calls: [{ ...present, entryPoint: "issue" }], otherActions: 0, offers: 0 }, "02cc"),
      presentationFault({ calls: [present], otherActions: 0, offers: 0 }, "02dd")
    ]

    assert.deepEqual(faults, [
      "a presentation moves no coins and calls nothing else",
      "a presentation moves no coins and calls nothing else",
      "a presentation is exactly one call",
      "a presentation is exactly one call",
      "the call is not present",
      "the call is not to the active registry"
    ])
  })
})
