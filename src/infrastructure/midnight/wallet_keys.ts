import { createKeystore, validateMnemonic, WalletSeeds } from "@midnightntwrk/wallet-sdk"
import { mnemonicToSeedSync } from "@scure/bip39"

function deriveWalletKeys(mnemonic: string, networkId: string) {
  if (!validateMnemonic(mnemonic)) {
    throw new Error("KINETIX_SEAL_SPONSOR_MNEMONIC is not a valid BIP-39 recovery phrase")
  }

  const seeds = WalletSeeds.fromMasterSeed(mnemonicToSeedSync(mnemonic))

  return {
    seeds,
    unshieldedKeystore: createKeystore({ kind: "schnorr", secret: seeds.unshielded }, networkId)
  }
}

export { deriveWalletKeys }
