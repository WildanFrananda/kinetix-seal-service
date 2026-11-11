import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { HDWallet, Roles } from "@midnightntwrk/wallet-sdk"
import { mnemonicToSeedSync } from "@scure/bip39"

import { deriveWalletKeys } from "../../../src/infrastructure/midnight/wallet_keys.ts"

const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

function seedsAsDerivedBefore(phrase: string) {
  const hd = HDWallet.fromSeed(mnemonicToSeedSync(phrase))

  if (hd.type !== "seedOk") {
    throw new Error("the test seed was refused")
  }

  const derived = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0)

  if (derived.type !== "keysDerived") {
    throw new Error("the test keys could not be derived")
  }

  return {
    shielded: derived.keys[Roles.Zswap],
    unshielded: derived.keys[Roles.NightExternal],
    dust: derived.keys[Roles.Dust]
  }
}

describe("the sponsor's wallet keys", () => {
  it("come from the same account, roles and index as before ledger 9, so the sponsor keeps its address", () => {
    const { seeds } = deriveWalletKeys(mnemonic, "preprod")
    const before = seedsAsDerivedBefore(mnemonic)

    assert.deepEqual(Buffer.from(seeds.shielded), Buffer.from(before.shielded))
    assert.deepEqual(Buffer.from(seeds.unshielded), Buffer.from(before.unshielded))
    assert.deepEqual(Buffer.from(seeds.dust), Buffer.from(before.dust))
  })

  it("name one address for one phrase and network", () => {
    const first = deriveWalletKeys(mnemonic, "preprod").unshieldedKeystore.getBech32Address().toString()
    const again = deriveWalletKeys(mnemonic, "preprod").unshieldedKeystore.getBech32Address().toString()

    assert.equal(first, again)
    assert.match(first, /^mn_addr_preprod1/)
  })

  it("refuse a phrase that is not BIP-39", () => {
    assert.throws(() => deriveWalletKeys("not a recovery phrase", "preprod"), /not a valid BIP-39 recovery phrase/)
  })
})
