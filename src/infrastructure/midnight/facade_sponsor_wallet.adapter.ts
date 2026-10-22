import type { FacadeState, WalletFacade } from "@midnightntwrk/wallet-sdk"
import type { Subscription } from "rxjs"

import type { SponsorWalletPort } from "../../application/ports/sponsor_wallet.port.ts"
import type { SponsorSnapshot } from "../../types/sponsor_snapshot.type.ts"
import { saveWalletState } from "./wallet_state_file.ts"

class FacadeSponsorWallet implements SponsorWalletPort {
  readonly #wallet: WalletFacade
  readonly #stateFile: string
  readonly #subscription: Subscription
  #latest: FacadeState | undefined

  constructor(wallet: WalletFacade, stateFile: string) {
    this.#wallet = wallet
    this.#stateFile = stateFile
    this.#subscription = wallet.state().subscribe((state) => {
      this.#latest = state
    })
  }

  async snapshot(): Promise<SponsorSnapshot> {
    const observedAt = new Date()
    const state = this.#latest

    if (state === undefined) {
      return { synced: false, dustBalance: 0n, dustCoins: 0, nightUtxos: 0, observedAt }
    }

    return {
      synced: state.isSynced,
      dustBalance: state.dust.balance(observedAt),
      dustCoins: state.dust.availableCoins.length,
      nightUtxos: state.unshielded.availableCoins.length,
      observedAt
    }
  }

  async checkpoint(): Promise<void> {
    await saveWalletState(this.#wallet, this.#stateFile)
  }

  async stop(): Promise<void> {
    this.#subscription.unsubscribe()
    await this.#wallet.stop()
  }
}

export default FacadeSponsorWallet
