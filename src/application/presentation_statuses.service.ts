import type { AnsweredPresentations } from "../types/answered_presentations.type.ts"
import type { PresentationStatus } from "../types/presentation_status.type.ts"
import type { PresentationLedgerPort } from "./ports/presentation_ledger.port.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"

class PresentationStatuses {
  private readonly ledger: PresentationLedgerPort
  private readonly generations: RegistryGenerationStorePort
  private readonly maxAgeSeconds: number
  private readonly clock: () => Date
  private cached: AnsweredPresentations | undefined
  private reading: Promise<AnsweredPresentations | undefined> | undefined

  constructor(
    ledger: PresentationLedgerPort,
    generations: RegistryGenerationStorePort,
    maxAgeSeconds: number,
    clock: () => Date
  ) {
    this.ledger = ledger
    this.generations = generations
    this.maxAgeSeconds = maxAgeSeconds
    this.clock = clock
  }

  async statusOf(challenge: string): Promise<PresentationStatus | undefined> {
    const answered = await this.answered()

    if (answered === undefined) {
      return undefined
    }

    return { generation: answered.generation, predicateId: answered.answers.get(challenge) }
  }

  private async answered(): Promise<AnsweredPresentations | undefined> {
    const cached = this.cached

    if (cached !== undefined && this.clock().getTime() - cached.readAt.getTime() < this.maxAgeSeconds * 1000) {
      return cached
    }

    if (this.reading === undefined) {
      this.reading = this.read().finally(() => {
        this.reading = undefined
      })
    }

    return this.reading
  }

  private async read(): Promise<AnsweredPresentations | undefined> {
    const active = (await this.generations.unretired()).find((generation) => generation.status === "active")

    if (active === undefined) {
      this.cached = undefined

      return undefined
    }

    this.cached = {
      generation: active.generation,
      contractAddress: active.contractAddress,
      answers: await this.ledger.presentations(active.contractAddress),
      readAt: this.clock()
    }

    return this.cached
  }
}

export default PresentationStatuses
