import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils"
import type { UnshieldedKeystore, WalletFacade } from "@midnightntwrk/wallet-sdk"

import NothingSubmitted from "../../domain/nothing_submitted.ts"

async function beforeSubmission<T>(prepare: () => Promise<T>): Promise<T> {
  try {
    return await prepare()
  } catch (error) {
    throw new NothingSubmitted(
      `the sponsor refused the spend before submitting it: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    )
  }
}

async function payAndSubmit(wallet: WalletFacade, keystore: UnshieldedKeystore, bytes: Uint8Array): Promise<string> {
  const finalized = await beforeSubmission(async () => {
    const recipe = await wallet.balanceUnboundTransaction(wallet.adoptTransaction(bytes, "Unbound"), {
      ttl: ttlOneHour()
    })

    return wallet.finalizeRecipe(await wallet.signRecipe(recipe, keystore.signDataAsync))
  })

  return wallet.submitTransaction(finalized)
}

async function sponsorAndSubmit(
  wallet: WalletFacade,
  keystore: UnshieldedKeystore,
  bytes: Uint8Array
): Promise<string> {
  const finalized = await beforeSubmission(async () => {
    const recipe = await wallet.balanceFinalizedTransaction(wallet.adoptTransaction(bytes, "Finalized"), {
      ttl: ttlOneHour(),
      tokenKindsToBalance: ["dust"]
    })

    return wallet.finalizeRecipe(await wallet.signRecipe(recipe, keystore.signDataAsync))
  })

  return wallet.submitTransaction(finalized)
}

export { payAndSubmit, sponsorAndSubmit }
