import type { SponsorEvent } from "../../types/sponsor_event.type.ts"

interface SponsorEventStorePort {
  record(event: SponsorEvent): Promise<void>
  latest(): Promise<SponsorEvent | undefined>
}

export type { SponsorEventStorePort }
