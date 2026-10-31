import type { SponsorConditionSourcePort } from "../../application/ports/sponsor_condition_source.port.ts"
import type { SponsorStateSourcePort } from "../../application/ports/sponsor_state_source.port.ts"
import type { SponsorWalletPort } from "../../application/ports/sponsor_wallet.port.ts"
import type { SponsorState } from "../../types/sponsor_state.type.ts"

class LocalSponsorState implements SponsorStateSourcePort {
  private readonly monitor: SponsorConditionSourcePort
  private readonly wallet: SponsorWalletPort

  constructor(monitor: SponsorConditionSourcePort, wallet: SponsorWalletPort) {
    this.monitor = monitor
    this.wallet = wallet
  }

  async state(): Promise<SponsorState> {
    const condition = this.monitor.condition()

    return { condition: condition === "unreachable" ? "syncing" : condition, snapshot: await this.wallet.snapshot() }
  }
}

export default LocalSponsorState
