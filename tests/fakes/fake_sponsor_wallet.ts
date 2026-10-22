import type { SponsorWalletPort } from "../../src/application/ports/sponsor_wallet.port.ts"
import type { SponsorSnapshot } from "../../src/types/sponsor_snapshot.type.ts"

class FakeSponsorWallet implements SponsorWalletPort {
  next: SponsorSnapshot
  checkpoints = 0
  stopped = false

  constructor(next: SponsorSnapshot) {
    this.next = next
  }

  async snapshot(): Promise<SponsorSnapshot> {
    return this.next
  }

  async checkpoint(): Promise<void> {
    this.checkpoints += 1
  }

  async stop(): Promise<void> {
    this.stopped = true
  }
}

export default FakeSponsorWallet
