import * as Rx from "rxjs"

import { withAdminWallet } from "./admin_wallet.ts"

await withAdminWallet("register-dust", async (wallet, keys, logger) => {
  const state = await wallet.waitForSyncedState()
  const unregistered = state.unshielded.availableCoins.filter((coin) => !coin.meta.registeredForDustGeneration)

  logger.info({
    message: "NIGHT UTXOs found",
    fields: { night_utxos: state.unshielded.availableCoins.length, unregistered: unregistered.length }
  })

  if (unregistered.length === 0) {
    return
  }

  const { fee } = await wallet.estimateRegistration(unregistered)

  logger.info({ message: "waiting for the registration fee to be generated", fields: { fee_speck: fee } })
  await wallet.waitForGeneratedDust(unregistered, fee)

  const recipe = await wallet.registerNightUtxosForDustGeneration(
    unregistered,
    keys.unshieldedKeystore.getPublicKey(),
    (payload) => keys.unshieldedKeystore.signData(payload)
  )

  const txId = await wallet.submitTransaction(await wallet.finalizeRecipe(recipe))

  logger.info({ message: "registration submitted", fields: { transaction: txId } })

  const registered = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.filter((s) => s.isSynced && s.dust.balance(new Date()) > 0n))
  )

  logger.info({ message: "the sponsor has DUST", fields: { dust_speck: registered.dust.balance(new Date()) } })
})
