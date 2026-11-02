import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { MAX_FIELD } from "@midnight-ntwrk/compact-runtime"

import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import { parseHolderPublicKey } from "../../src/domain/holder_public_key.ts"

describe("a holder's public key", () => {
  it("reads the key a holder's secret makes, in decimal", () => {
    const key = pureCircuits.holderPublicKey(new Uint8Array(32).fill(9))

    assert.equal(parseHolderPublicKey(key.toString()), key)
  })

  it("accepts the largest field element and nothing beyond it", () => {
    assert.equal(parseHolderPublicKey(MAX_FIELD.toString()), MAX_FIELD)
    assert.equal(parseHolderPublicKey((MAX_FIELD + 1n).toString()), undefined)
  })

  it("refuses anything that is not a plain decimal number", () => {
    for (const text of ["", "-1", "0x10", "1e3", " 12", "12 ", "012", "1.5", "9".repeat(79)]) {
      assert.equal(parseHolderPublicKey(text), undefined, text)
    }
  })
})
