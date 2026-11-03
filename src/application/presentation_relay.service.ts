import { presentationFault } from "../domain/presentation_shape.ts"
import type { PresentationRelayDependencies } from "../types/presentation_relay_dependencies.type.ts"
import type { RelayOutcome } from "../types/relay_outcome.type.ts"

class PresentationRelay {
  private readonly dependencies: PresentationRelayDependencies

  constructor(dependencies: PresentationRelayDependencies) {
    this.dependencies = dependencies
  }

  async relay(transaction: Uint8Array): Promise<RelayOutcome> {
    const outcome = await this.decide(transaction)

    this.dependencies.metrics.relayed(outcome.kind)

    return outcome
  }

  private async decide(transaction: Uint8Array): Promise<RelayOutcome> {
    const { inspector, payer, generations } = this.dependencies
    const active = (await generations.unretired()).find((generation) => generation.status === "active")

    if (active === undefined) {
      return { kind: "no_registry" }
    }

    const inspected = inspector.inspect(transaction)

    if (inspected === undefined) {
      return { kind: "not_a_presentation", reason: "the bytes are not a proven, bound transaction" }
    }

    const fault = presentationFault(inspected, active.contractAddress)

    if (fault !== undefined) {
      return { kind: "not_a_presentation", reason: fault }
    }

    try {
      return { kind: "relayed", txId: await payer.sponsor(transaction) }
    } catch (error) {
      return { kind: "sponsor_unavailable", reason: error instanceof Error ? error.message : String(error) }
    }
  }
}

export default PresentationRelay
