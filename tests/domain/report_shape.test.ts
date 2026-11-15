import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { matchingReportCall } from "../../src/domain/report_shape.ts"
import type { InspectedReportTransaction } from "../../src/types/inspected_report_transaction.type.ts"

const contractAddress = "0200abcd"
const expectedDigest = new Uint8Array(32).fill(7)

function validTransaction(): InspectedReportTransaction {
  return {
    calls: [
      {
        address: contractAddress,
        entryPoint: "report",
        nullifier: new Uint8Array(32).fill(1),
        merchantTag: new Uint8Array(32).fill(2),
        window: 682n,
        digest: Uint8Array.from(expectedDigest)
      }
    ],
    otherActions: 0,
    offers: 0
  }
}

describe("matchingReportCall", () => {
  it("accepts a lone report call to the active registry with a matching digest", () => {
    const matched = matchingReportCall(validTransaction(), contractAddress.toUpperCase(), expectedDigest)

    assert.ok(matched !== undefined)
    assert.equal(matched.window, 682n)
  })

  it("refuses transactions carrying offers, extra actions, wrong entrypoints, other contracts, or mismatched digests", () => {
    const withOffer = { ...validTransaction(), offers: 1 }

    assert.equal(matchingReportCall(withOffer, contractAddress, expectedDigest), undefined)

    const withOtherAction = { ...validTransaction(), otherActions: 1 }

    assert.equal(matchingReportCall(withOtherAction, contractAddress, expectedDigest), undefined)

    const withTwoCalls = {
      ...validTransaction(),
      calls: [...validTransaction().calls, ...validTransaction().calls]
    }

    assert.equal(matchingReportCall(withTwoCalls, contractAddress, expectedDigest), undefined)

    const baseCall = validTransaction().calls[0]

    assert.ok(baseCall !== undefined)

    const wrongEntryPoint = { ...validTransaction(), calls: [{ ...baseCall, entryPoint: "grant" }] }

    assert.equal(matchingReportCall(wrongEntryPoint, contractAddress, expectedDigest), undefined)

    const wrongAddress = { ...validTransaction(), calls: [{ ...baseCall, address: "0200dead" }] }

    assert.equal(matchingReportCall(wrongAddress, contractAddress, expectedDigest), undefined)

    const wrongDigest = { ...validTransaction(), calls: [{ ...baseCall, digest: new Uint8Array(32).fill(9) }] }

    assert.equal(matchingReportCall(wrongDigest, contractAddress, expectedDigest), undefined)
  })
})
