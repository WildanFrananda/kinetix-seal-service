import type { SponsorEventStorePort } from "../../application/ports/sponsor_event_store.port.ts"
import type { SponsorCondition } from "../../types/sponsor_condition.type.ts"
import type { SponsorEvent } from "../../types/sponsor_event.type.ts"
import type { PrismaClient } from "./generated/client.ts"

const conditions: readonly SponsorCondition[] = ["syncing", "healthy", "low_dust", "no_dust"]

class PrismaSponsorEventStore implements SponsorEventStorePort {
  private readonly prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async record(event: SponsorEvent): Promise<void> {
    await this.prisma.sponsorEvent.create({
      data: {
        occurredAt: event.occurredAt,
        condition: event.condition,
        dustBalance: event.dustBalance.toString(),
        dustCoins: event.dustCoins,
        nightUtxos: event.nightUtxos
      }
    })
  }

  async latest(): Promise<SponsorEvent | undefined> {
    const row = await this.prisma.sponsorEvent.findFirst({ orderBy: { id: "desc" } })

    if (row === null) {
      return undefined
    }

    const condition = conditions.find((candidate) => candidate === row.condition)

    if (condition === undefined) {
      throw new Error(`sponsor_events row ${row.id} holds an unknown condition: ${row.condition}`)
    }

    return {
      occurredAt: row.occurredAt,
      condition,
      dustBalance: BigInt(row.dustBalance.toFixed(0)),
      dustCoins: row.dustCoins,
      nightUtxos: row.nightUtxos
    }
  }
}

export default PrismaSponsorEventStore
