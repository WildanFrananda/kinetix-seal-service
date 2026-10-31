import type { SponsorStateSourcePort } from "../../src/application/ports/sponsor_state_source.port.ts"
import type { SponsorState } from "../../src/types/sponsor_state.type.ts"
import { snapshot } from "./snapshot.ts"

class FakeSponsorStateSource implements SponsorStateSourcePort {
  next: SponsorState | Error = { condition: "healthy", snapshot: snapshot({}) }
  asked = 0

  async state(): Promise<SponsorState> {
    this.asked += 1

    if (this.next instanceof Error) {
      throw this.next
    }

    return this.next
  }
}

export default FakeSponsorStateSource
