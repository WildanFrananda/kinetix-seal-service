import type { UnboundTransaction } from "@midnight-ntwrk/midnight-js-types"
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils"
import type { WalletFacade } from "@midnightntwrk/wallet-sdk"

import type { WalletKeys } from "../../types/wallet_keys.type.ts"

async function payAndSubmit(wallet: WalletFacade, keys: WalletKeys, transaction: UnboundTransaction): Promise<string> {
  const recipe = await wallet.balanceUnboundTransaction(
    transaction,
    { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
    { ttl: ttlOneHour() }
  )
  const signed = await wallet.signRecipe(recipe, (payload) => keys.unshieldedKeystore.signData(payload))

  return wallet.submitTransaction(await wallet.finalizeRecipe(signed))
}

export { payAndSubmit }
