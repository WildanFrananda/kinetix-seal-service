import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils"
import type { FinalizedTx, UnboundTx, UnshieldedKeystore, WalletFacade } from "@midnightntwrk/wallet-sdk"

async function payAndSubmit(
  wallet: WalletFacade,
  keystore: UnshieldedKeystore,
  transaction: UnboundTx
): Promise<string> {
  const recipe = await wallet.balanceUnboundTransaction(transaction, { ttl: ttlOneHour() })
  const signed = await wallet.signRecipe(recipe, keystore.signDataAsync)

  return wallet.submitTransaction(await wallet.finalizeRecipe(signed))
}

async function sponsorAndSubmit(
  wallet: WalletFacade,
  keystore: UnshieldedKeystore,
  transaction: FinalizedTx
): Promise<string> {
  const recipe = await wallet.balanceFinalizedTransaction(transaction, {
    ttl: ttlOneHour(),
    tokenKindsToBalance: ["dust"]
  })

  const signed = await wallet.signRecipe(recipe, keystore.signDataAsync)

  return wallet.submitTransaction(await wallet.finalizeRecipe(signed))
}

export { payAndSubmit, sponsorAndSubmit }
