import type { RegistryChainPort } from "../../src/application/ports/registry_chain.port.ts"
import type { AnchorObservation } from "../../src/types/anchor_observation.type.ts"
import type { DeployReceipt } from "../../src/types/deploy_receipt.type.ts"
import type { PreparedDeploy } from "../../src/types/prepared_deploy.type.ts"
import type { RegistryGeneration } from "../../src/types/registry_generation.type.ts"

class FakeRegistryChain implements RegistryChainPort {
  anchors: Array<AnchorObservation | Error> = []
  submitFails: Error | undefined
  readonly prepared: number[] = []
  readonly submitted: number[] = []

  async prepareDeploy(generation: number): Promise<PreparedDeploy> {
    this.prepared.push(generation)

    const chain = this

    return {
      contractAddress: `02${generation.toString().padStart(4, "0")}`,
      async submit(): Promise<DeployReceipt> {
        if (chain.submitFails !== undefined) {
          throw chain.submitFails
        }

        chain.submitted.push(generation)

        return { txId: `00tx${generation}`, blockHeight: 3_300_000 + generation, blockHash: "c".repeat(64) }
      }
    }
  }

  async observeAnchor(_generation: RegistryGeneration): Promise<AnchorObservation> {
    const next = this.anchors.shift() ?? "unchanged"

    if (next instanceof Error) {
      throw next
    }

    return next
  }
}

export default FakeRegistryChain
