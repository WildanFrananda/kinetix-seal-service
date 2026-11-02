import { hexOf } from "../domain/hex.ts"
import { issueDayOf } from "../domain/issue_day.ts"
import { predicateRowsOf } from "../domain/predicate_rows.ts"
import type { PlacedPredicate } from "../types/placed_predicate.type.ts"
import type { PredicateKeeperDependencies } from "../types/predicate_keeper_dependencies.type.ts"
import type { PredicateStep } from "../types/predicate_step.type.ts"
import type { RegistryGeneration } from "../types/registry_generation.type.ts"
import type { RegistryReceipt } from "../types/registry_receipt.type.ts"

class PredicateKeeper {
  private readonly dependencies: PredicateKeeperDependencies
  private running = false

  constructor(dependencies: PredicateKeeperDependencies) {
    this.dependencies = dependencies
  }

  async reconcile(): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true

    try {
      await this.bringUpToDate()
    } finally {
      this.running = false
    }
  }

  private async bringUpToDate(): Promise<void> {
    const { chain, generations, metrics } = this.dependencies
    const active = (await generations.unretired()).find((generation) => generation.status === "active")

    if (active === undefined) {
      return
    }

    const desired = await this.desired()
    const placed = new Map<string, PlacedPredicate>()

    for (const placement of await chain.placed(active.contractAddress)) {
      placed.set(hexOf(placement.id), placement)
    }

    await this.mirror(active, placed)

    const steps: PredicateStep[] = [
      ...[...desired.values()]
        .filter((wanted) => !placed.has(hexOf(wanted.id)))
        .map((wanted): PredicateStep => ({ change: "approve", placement: wanted })),
      ...[...placed.values()]
        .filter((placement) => !desired.has(hexOf(placement.id)))
        .map((placement): PredicateStep => ({ change: "withdraw", placement }))
    ]

    metrics.drifted(steps.length)

    for (const [index, step] of steps.entries()) {
      if (!(await this.apply(active, step, placed))) {
        return
      }

      metrics.drifted(steps.length - index - 1)
    }
  }

  private async desired(): Promise<Map<string, PlacedPredicate>> {
    const { chain, templates, clock, periodDays } = this.dependencies
    const day = issueDayOf(clock())
    const desired = new Map<string, PlacedPredicate>()

    for (const template of await templates.live()) {
      for (const row of predicateRowsOf(template, day, periodDays)) {
        const id = chain.predicateIdOf(row.predicate)

        desired.set(hexOf(id), { id, predicate: row.predicate })
      }
    }

    return desired
  }

  private async apply(
    active: RegistryGeneration,
    step: PredicateStep,
    placed: Map<string, PlacedPredicate>
  ): Promise<boolean> {
    const { metrics, logger } = this.dependencies
    const id = hexOf(step.placement.id)
    let receipt: RegistryReceipt

    try {
      receipt = await this.submit(active, step)
    } catch (error) {
      metrics.changed(step.change, "failed")
      logger.warn({
        message: "the registry's predicates could not be brought up to date; it is tried again on the next tick",
        fields: {
          generation: active.generation,
          predicate_id: id,
          change: step.change,
          cause: error instanceof Error ? error.message : String(error)
        }
      })

      return false
    }

    if (step.change === "approve") {
      placed.set(id, step.placement)
    } else {
      placed.delete(id)
    }

    await this.mirror(active, placed)
    metrics.changed(step.change, "done")
    logger.info({
      message:
        step.change === "approve"
          ? "a predicate was approved on the registry"
          : "a predicate was withdrawn from the registry",
      fields: { generation: active.generation, predicate_id: id, tx_id: receipt.txId }
    })

    return true
  }

  private async submit(active: RegistryGeneration, step: PredicateStep): Promise<RegistryReceipt> {
    const { chain } = this.dependencies

    if (step.change === "approve") {
      return chain.approve(active.contractAddress, step.placement.predicate)
    }

    return chain.withdraw(active.contractAddress, step.placement.id)
  }

  private async mirror(active: RegistryGeneration, placed: Map<string, PlacedPredicate>): Promise<void> {
    const { placements, clock } = this.dependencies

    await placements.replace(active.generation, [...placed.values()], clock())
  }
}

export default PredicateKeeper
