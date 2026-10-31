import type { SponsorState } from "../../types/sponsor_state.type.ts"

interface SponsorStateSourcePort {
  state(): Promise<SponsorState>
}

export type { SponsorStateSourcePort }
