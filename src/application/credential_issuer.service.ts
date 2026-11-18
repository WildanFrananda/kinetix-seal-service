import type { RegistryGeneration } from "../types/registry_generation.type.ts"
import type { UnsettledIssuance } from "../types/unsettled_issuance.type.ts"
import type { CredentialChainPort } from "./ports/credential_chain.port.ts"
import type { CredentialMetricsPort } from "./ports/credential_metrics.port.ts"
import type { CredentialStorePort } from "./ports/credential_store.port.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"
import { settleGenerationQueue } from "./settle_generation_queue.ts"

class CredentialIssuer {
  private readonly chain: CredentialChainPort
  private readonly store: CredentialStorePort
  private readonly generations: RegistryGenerationStorePort
  private readonly metrics: CredentialMetricsPort
  private readonly logger: LoggerPort
  private readonly clock: () => Date
  private running = false

  constructor(
    chain: CredentialChainPort,
    store: CredentialStorePort,
    generations: RegistryGenerationStorePort,
    metrics: CredentialMetricsPort,
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
      const { store, logger } = this
      const clock = this.clock.bind(this)

      await settleGenerationQueue({
        generations: this.generations,
        queue: function (generation) {
          return store.queueCurrent(generation, clock())
        },
        onQueued: function (generation, count) {
          logger.info({
            message: "credentials were queued for issuance",
            fields: { generation, count }
          })
        },
        nextUnsettled: function (generation) {
          return store.nextUnsettled(generation)
        },
        settleOne: this.settleOne.bind(this)
      })
    } finally {
      this.running = false
    }
  }

  private async settleOne(active: RegistryGeneration, unsettled: UnsettledIssuance): Promise<boolean> {
    const { issuance, credential } = unsettled
    const leaf = issuance.leaf ?? this.chain.leafOf(credential)

    try {
      if (issuance.status === "uncertain") {
        const landed = await this.chain.locate(active.contractAddress, leaf)

        if (landed !== undefined) {
          await this.issued(active, credential.id, landed, undefined)

          return true
        }
      }

      await this.store.markUncertain(credential.id, active.generation, leaf, this.clock())

      const receipt = await this.chain.issue(active.contractAddress, leaf)
      const index = await this.chain.locate(active.contractAddress, leaf)

      if (index === undefined) {
        throw new Error(`the issue was confirmed (tx ${receipt.txId}) and its leaf is not in the registry`)
      }

      await this.issued(active, credential.id, index, receipt.txId)

      return true
    } catch (error) {
      this.metrics.issued("failed")
      this.logger.warn({
        message: "a credential could not be issued; it is tried again on the next tick",
        fields: {
          credential_id: credential.id,
          generation: active.generation,
          cause: error instanceof Error ? error.message : String(error)
        }
      })

      return false
    }
  }

  private async issued(
    active: RegistryGeneration,
    credentialId: string,
    leafIndex: bigint,
    txId: string | undefined
  ): Promise<void> {
    await this.store.markIssued(credentialId, active.generation, leafIndex, txId, this.clock())
    this.metrics.issued("issued")
    this.logger.info({
      message: "a credential was issued",
      fields: { credential_id: credentialId, generation: active.generation, leaf_index: leafIndex.toString() }
    })
  }
}

export default CredentialIssuer
