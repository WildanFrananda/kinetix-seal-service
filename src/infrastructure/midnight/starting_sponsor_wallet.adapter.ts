import type { SponsorWalletPort } from "../../application/ports/sponsor_wallet.port.ts"
import type { SponsorSnapshot } from "../../types/sponsor_snapshot.type.ts"

class StartingSponsorWallet implements SponsorWalletPort {
  #started: SponsorWalletPort | undefined

  started(wallet: SponsorWalletPort): void {
    this.#started = wallet
  }

  async snapshot(): Promise<SponsorSnapshot> {
    if (this.#started === undefined) {
      return { synced: false, dustBalance: 0n, dustCoins: 0, nightUtxos: 0, observedAt: new Date() }
    }

    return this.#started.snapshot()
  }

  async checkpoint(): Promise<void> {
    await this.#started?.checkpoint()
  }

  async stop(): Promise<void> {
    await this.#started?.stop()
  }
}

export default StartingSponsorWallet
