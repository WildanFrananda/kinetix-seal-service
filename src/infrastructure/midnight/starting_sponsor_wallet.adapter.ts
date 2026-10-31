import type { SponsorWalletPort } from "../../application/ports/sponsor_wallet.port.ts"
import type { SponsorSnapshot } from "../../types/sponsor_snapshot.type.ts"

class StartingSponsorWallet implements SponsorWalletPort {
  private delegate: SponsorWalletPort | undefined

  started(wallet: SponsorWalletPort): void {
    this.delegate = wallet
  }

  async snapshot(): Promise<SponsorSnapshot> {
    if (this.delegate === undefined) {
      return { synced: false, dustBalance: 0n, dustCoins: 0, nightUtxos: 0, observedAt: new Date() }
    }

    return this.delegate.snapshot()
  }

  async checkpoint(): Promise<void> {
    await this.delegate?.checkpoint()
  }

  async stop(): Promise<void> {
    await this.delegate?.stop()
  }
}

export default StartingSponsorWallet
