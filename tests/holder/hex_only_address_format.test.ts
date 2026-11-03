import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { bytesOf, hexOf } from "../../holder/src/hex.ts"
import {
  MidnightBech32m,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey
} from "../../holder/src/hex_only_address_format.ts"

describe("what the holder bundle carries instead of the bech32 helper", () => {
  it("refuses bech32 loudly in every entry point midnight-js reaches", () => {
    assert.throws(() => MidnightBech32m.parse(), /hex/)
    assert.throws(() => ShieldedCoinPublicKey.codec.decode(), /hex/)
    assert.throws(() => ShieldedEncryptionPublicKey.codec.decode(), /hex/)
  })

  it("converts hex without Buffer, and refuses what is not hex", () => {
    assert.equal(hexOf(bytesOf("00ff7a")), "00ff7a")
    assert.throws(() => bytesOf("abc"), /even/)
    assert.throws(() => bytesOf("zz"), /0-9/)
  })
})
