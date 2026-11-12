import type { RegistryGeneration } from "../types/registry_generation.type.ts"
import type { UnsettledGrant } from "../types/unsettled_grant.type.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"
import type { ReportChainPort } from "./ports/report_chain.port.ts"
import type { ReportMetricsPort } from "./ports/report_metrics.port.ts"
import type { ReportRightStorePort } from "./ports/report_right_store.port.ts"

class RightGranter {
  private readonly chain: ReportChainPort
  private readonly store: ReportRightStorePort
  private readonly generations: RegistryGenerationStorePort
  private readonly metrics: ReportMetricsPort
  private readonly logger: LoggerPort
  private readonly clock: () => Date
  private running = false

  constructor(
    chain: ReportChainPort,
    store: ReportRightStorePort,
    generations: RegistryGenerationStorePort,
    metrics: ReportMetricsPort,
    logger: LoggerPort,
    clock: () => Date
  ) {
    this.chain = chain
    this.store = store
    this.generations = generations
    this.metrics = metrics
    this.logger = logger
    this.clock = clock
  }

  async settle(): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true

    try {
      await this.settleQueue()
    } finally {
      this.running = false
    }
  }

  private async settleQueue(): Promise<void> {
    const active = (await this.generations.unretired()).find((generation) => generation.status === "active")

    if (active === undefined) {
      return
    }

    const queued = await this.store.queueAll(active.generation, this.clock())

    if (queued > 0) {
      this.logger.info({
        message: "report rights were queued for granting",
        fields: { generation: active.generation, count: queued }
      })
    }

    for (;;) {
      const next = await this.store.nextUnsettled(active.generation)

      if (next === undefined || !(await this.settleOne(active, next))) {
        return
      }
    }
  }

  private async settleOne(active: RegistryGeneration, unsettled: UnsettledGrant): Promise<boolean> {
    const { right, status } = unsettled

    try {
      if (status === "uncertain") {
        const landed = await this.chain.locate(active.contractAddress, right.leaf)

        if (landed !== undefined) {
          await this.granted(active, right.id, landed, undefined)

          return true
        }
      }

      await this.store.markUncertain(right.id, active.generation, this.clock())

      const receipt = await this.chain.grant(active.contractAddress, right.leaf)
      const index = await this.chain.locate(active.contractAddress, right.leaf)

      if (index === undefined) {
        throw new Error(`the grant was confirmed (tx ${receipt.txId}) and its leaf is not in the registry`)
      }

      await this.granted(active, right.id, index, receipt.txId)

      return true
    } catch (error) {
      this.metrics.granted("failed")
      this.logger.warn({
        message: "a report right could not be granted; it is tried again on the next tick",
        fields: {
          right_id: right.id,
          generation: active.generation,
          cause: error instanceof Error ? error.message : String(error)
        }
      })

      return false
    }
  }

  private async granted(
    active: RegistryGeneration,
    rightId: string,
    leafIndex: bigint,
    txId: string | undefined
  ): Promise<void> {
    await this.store.markGranted(rightId, active.generation, leafIndex, txId, this.clock())
    this.metrics.granted("granted")
    this.logger.info({
      message: "a report right was granted",
      fields: { right_id: rightId, generation: active.generation, leaf_index: leafIndex.toString() }
    })
  }
}

export default RightGranter
