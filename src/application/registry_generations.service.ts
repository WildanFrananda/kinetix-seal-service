import { confirmedAnchor, decideRegistryGeneration } from "../domain/registry_generation_decision.ts"
import type { AnchorObservation } from "../types/anchor_observation.type.ts"
import type { RegistryGeneration } from "../types/registry_generation.type.ts"
import type { RegistryGenerationDecision } from "../types/registry_generation_decision.type.ts"
import type { LoggerPort } from "./ports/logger.port.ts"
import type { RegistryChainPort } from "./ports/registry_chain.port.ts"
import type { RegistryGaugesPort } from "./ports/registry_gauges.port.ts"
import type { RegistryGenerationStorePort } from "./ports/registry_generation_store.port.ts"

class RegistryGenerations {
  readonly #chain: RegistryChainPort
  readonly #store: RegistryGenerationStorePort
  readonly #gauges: RegistryGaugesPort
  readonly #logger: LoggerPort
  readonly #networkId: string
  readonly #buildDigest: string
  #previousAnchor: AnchorObservation | undefined
  #running = false

  constructor(
    chain: RegistryChainPort,
    store: RegistryGenerationStorePort,
    gauges: RegistryGaugesPort,
    logger: LoggerPort,
    networkId: string,
    buildDigest: string
  ) {
    this.#chain = chain
    this.#store = store
    this.#gauges = gauges
    this.#logger = logger
    this.#networkId = networkId
    this.#buildDigest = buildDigest
  }

  async reconcile(): Promise<RegistryGenerationDecision | undefined> {
    if (this.#running) {
      return undefined
    }

    this.#running = true

    try {
      return await this.#reconcile()
    } finally {
      this.#running = false
    }
  }

  async #reconcile(): Promise<RegistryGenerationDecision> {
    const generations = await this.#store.unretired()
    const active = generations.find((generation) => generation.status === "active")
    const anchor = active === undefined ? undefined : await this.#anchorOf(active)
    const decision = decideRegistryGeneration(generations, this.#buildDigest, anchor)

    for (const retirement of decision.retire) {
      await this.#store.retire(retirement)
      this.#logger.warn({
        message: "a registry generation was retired",
        fields: { generation: retirement.generation, reason: retirement.reason }
      })
    }

    if (decision.action === "deploy") {
      await this.#deploy()
    } else if (active !== undefined) {
      this.#gauges.activeGeneration(active.generation)
    }

    return decision
  }

  async #anchorOf(active: RegistryGeneration): Promise<AnchorObservation | undefined> {
    if (active.buildDigest !== this.#buildDigest) {
      return undefined
    }

    const observed = await this.#chain.observeAnchor(active).catch((error: unknown) => {
      this.#logger.warn({
        message: "the registry's chain could not be observed",
        fields: { generation: active.generation, cause: error instanceof Error ? error.message : String(error) }
      })

      return "unknown" as const
    })
    const anchor = confirmedAnchor(this.#previousAnchor, observed)

    this.#previousAnchor = observed

    return anchor
  }

  async #deploy(): Promise<void> {
    const generation = (await this.#store.highestGeneration()) + 1
    const prepared = await this.#chain.prepareDeploy(generation)

    await this.#store.recordDeploying({
      generation,
      contractAddress: prepared.contractAddress,
      networkId: this.#networkId,
      buildDigest: this.#buildDigest,
      status: "deploying",
      deployTxId: undefined,
      anchorHeight: undefined,
      anchorHash: undefined
    })
    this.#logger.info({
      message: "deploying a registry generation",
      fields: { generation, contract_address: prepared.contractAddress }
    })

    try {
      const receipt = await prepared.submit()

      await this.#store.activate(generation, receipt)
      this.#previousAnchor = undefined
      this.#gauges.activeGeneration(generation)
      this.#gauges.deployed("succeeded")
      this.#logger.info({
        message: "a registry generation is active",
        fields: { generation, contract_address: prepared.contractAddress, block_height: receipt.blockHeight }
      })
    } catch (error) {
      this.#gauges.deployed("failed")
      this.#logger.error({ message: "the registry generation could not be deployed", fields: { generation } }, error)
    }
  }
}

export default RegistryGenerations
