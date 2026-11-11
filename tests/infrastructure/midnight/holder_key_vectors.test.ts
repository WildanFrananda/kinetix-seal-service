import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { pureCircuits } from "#contracts/credential_registry/contract/index.js"

const secret = new Uint8Array(32).map((_, index) => index + 1)
const classId = new Uint8Array(32).fill(7)

describe("the hashes a holder's credential rests on", () => {
  it("give the holder key compactc 0.31.1 gave, so a holder keeps its key across a compiler change", () => {
    assert.equal(
      pureCircuits.holderPublicKey(secret).toString(),
      "27636804102645859938327521264782305359005459789736573182417175584659677171739"
    )
  })

  it("give the credential leaf compactc 0.31.1 gave, so a new generation re-issues the same leaf", () => {
    const leaf = pureCircuits.credentialLeaf(
      { classId, attributes: [1n, 2n, 3n, 4n], salt: new Uint8Array(32).fill(9) },
      12_345n
    )

    assert.equal(Buffer.from(leaf).toString("hex"), "9f41cc4b7c0bca028bd0d112d28a1d9a17b9868263432279c45473b294eed000")
  })

  it("give the predicate id compactc 0.31.1 gave, so an approved row keeps its id", () => {
    const id = pureCircuits.predicateId({ classId, minimums: [1n, 2n, 3n, 4n] })

    assert.equal(Buffer.from(id).toString("hex"), "d08890f4b0ce726dc7c11c1c898c64cd91d3f9b665bc3b8e8dea11514b342827")
  })
})
