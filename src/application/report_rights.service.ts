import { randomUUID } from "node:crypto"

import { reportOrderOf } from "../domain/report_order.ts"
import { reportWindowOf } from "../domain/report_window.ts"
import type { CallerPrincipal } from "../types/caller_principal.type.ts"
import type { HeldRight } from "../types/held_right.type.ts"
import type { RegistryGeneration } from "../types/registry_generation.type.ts"
import type { ReportRight } from "../types/report_right.type.ts"
import type { RightCandidate } from "../types/right_candidate.type.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"
import type { ReportChainPort } from "./ports/report_chain.port.ts"
import type { ReportMetricsPort } from "./ports/report_metrics.port.ts"
import type { ReportRightStorePort } from "./ports/report_right_store.port.ts"

class ReportRights {
  private readonly store: ReportRightStorePort
  private readonly chain: ReportChainPort
  private readonly generations: RegistryGenerationStorePort
  private readonly metrics: ReportMetricsPort
  private readonly clock: () => Date
  private readonly batchSize: number

  constructor(
    store: ReportRightStorePort,
    chain: ReportChainPort,
    generations: RegistryGenerationStorePort,
    metrics: ReportMetricsPort,
    clock: () => Date,
    batchSize: number
  ) {
    this.store = store
    this.chain = chain
    this.generations = generations
    this.metrics = metrics
    this.clock = clock
    this.batchSize = batchSize
  }

  async addDue(): Promise<number> {
    let added = 0

    for (;;) {
      const candidates = await this.store.candidates(this.batchSize)

      if (candidates.length === 0) {
        return added
      }

      const inserted = await this.store.insert(candidates.map((candidate) => this.rightOf(candidate)))

      added += inserted
      this.metrics.rightsAdded(inserted)

      if (candidates.length < this.batchSize || inserted === 0) {
        return added
      }
    }
  }

  async heldBy(caller: CallerPrincipal): Promise<{ registry: RegistryGeneration | undefined; rights: HeldRight[] }> {
    const registry = (await this.generations.unretired()).find((generation) => generation.status === "active")

    return { registry, rights: await this.store.heldBy(caller.principalId, registry?.generation) }
  }

  private rightOf(candidate: RightCandidate): ReportRight {
    const merchantTag = this.chain.merchantTagOf(candidate.merchantPrincipalId)
    const window = reportWindowOf(candidate.deliveredAt)

    return {
      id: randomUUID(),
      reporterId: candidate.reporterId,
      principalId: candidate.principalId,
      role: candidate.role,
      orderNumber: candidate.orderNumber,
      merchantTag,
      window,
      leaf: this.chain.rightLeafOf({
        merchantTag,
        window,
        order: reportOrderOf(candidate.orderNumber),
        reporterKey: candidate.reporterKey
      }),
      createdAt: this.clock()
    }
  }
}

export default ReportRights
