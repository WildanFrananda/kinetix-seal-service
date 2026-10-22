import type { SponsorEventStorePort } from "../../src/application/ports/sponsor_event_store.port.ts"
import type { SponsorEvent } from "../../src/types/sponsor_event.type.ts"

class FakeSponsorEventStore implements SponsorEventStorePort {
  readonly recorded: SponsorEvent[] = []

  async record(event: SponsorEvent): Promise<void> {
    this.recorded.push(event)
  }

  async latest(): Promise<SponsorEvent | undefined> {
    return this.recorded.at(-1)
  }
}

export default FakeSponsorEventStore
