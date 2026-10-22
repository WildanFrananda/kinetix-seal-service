import { nativeToken } from "@midnight-ntwrk/midnight-js-protocol/ledger"
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils"
import * as Rx from "rxjs"

import SettingReader from "../infrastructure/config/setting_reader.ts"
import { withAdminWallet } from "./admin_wallet.ts"

const read = new SettingReader(process.env)
const outputs = read.positiveInteger("KINETIX_SEAL_SPLIT_OUTPUTS")

read.verify()

await withAdminWallet("split-night", async (wallet, keys, logger) => {
  const state = await wallet.waitForSyncedState()
  const coins = state.unshielded.availableCoins
  const total = coins.reduce((sum, coin) => sum + coin.utxo.value, 0n)

  if (coins.length >= outputs) {
    logger.info({ message: "already split", fields: { night_utxos: coins.length } })

    return
  }

  await Rx.firstValueFrom(
    wallet
      .state()
      .pipe(Rx.filter((s) => s.isSynced && s.dust.availableCoins.length > 0 && s.dust.balance(new Date()) > 0n))
  )

  const share = total / BigInt(outputs)
  const address = await wallet.unshielded.getAddress()

  const recipe = await wallet.transferTransaction(
    [
      {
        type: "unshielded",
        outputs: Array.from({ length: outputs - 1 }, () => ({
          type: nativeToken().raw,
          receiverAddress: address,
          amount: share
        }))
      }
    ],
    { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
    { ttl: ttlOneHour() }
  )

  const signed = await wallet.signRecipe(recipe, (payload) => keys.unshieldedKeystore.signData(payload))
  const txId = await wallet.submitTransaction(await wallet.finalizeRecipe(signed))

  logger.info({ message: "split submitted", fields: { transaction: txId, outputs, share_star: share } })

  const split = await Rx.firstValueFrom(
    wallet.state().pipe(Rx.filter((s) => s.isSynced && s.unshielded.availableCoins.length >= outputs))
  )

  logger.info({
    message: "the NIGHT is split",
    fields: { night_utxos: split.unshielded.availableCoins.length, dust_coins: split.dust.availableCoins.length }
  })
})
