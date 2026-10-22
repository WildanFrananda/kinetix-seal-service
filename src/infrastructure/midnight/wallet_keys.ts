import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id"
import * as ledger from "@midnight-ntwrk/midnight-js-protocol/ledger"
import { createKeystore, HDWallet, Roles, validateMnemonic } from "@midnightntwrk/wallet-sdk"
import { mnemonicToSeedSync } from "@scure/bip39"

function deriveWalletKeys(mnemonic: string) {
  if (!validateMnemonic(mnemonic)) {
    throw new Error("KINETIX_SEAL_SPONSOR_MNEMONIC is not a valid BIP-39 recovery phrase")
  }

  const hd = HDWallet.fromSeed(mnemonicToSeedSync(mnemonic))

  if (hd.type !== "seedOk") {
    throw new Error("the sponsor seed was refused by the HD wallet")
  }

  const derived = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0)

  hd.hdWallet.clear()

  if (derived.type !== "keysDerived") {
    throw new Error("the sponsor's keys could not be derived")
  }

  return {
    shieldedSecretKeys: ledger.ZswapSecretKeys.fromSeed(derived.keys[Roles.Zswap]),
    dustSecretKey: ledger.DustSecretKey.fromSeed(derived.keys[Roles.Dust]),
    unshieldedKeystore: createKeystore(derived.keys[Roles.NightExternal], getNetworkId())
  }
}

export { deriveWalletKeys }
