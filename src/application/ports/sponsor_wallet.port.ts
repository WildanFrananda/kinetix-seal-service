import type { SponsorSnapshot } from "../../types/sponsor_snapshot.type.ts"

interface SponsorWalletPort {
  snapshot(): Promise<SponsorSnapshot>
  checkpoint(): Promise<void>
  stop(): Promise<void>
}

export type { SponsorWalletPort }
