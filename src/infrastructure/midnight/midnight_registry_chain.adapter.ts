import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import type { RegistryChainPort } from "../../application/ports/registry_chain.port.ts"
import type { AnchorObservation } from "../../types/anchor_observation.type.ts"
import type { MidnightRegistryChainDependencies } from "../../types/midnight_registry_chain_dependencies.type.ts"
import type { PreparedDeploy } from "../../types/prepared_deploy.type.ts"
import type { RegistryGeneration } from "../../types/registry_generation.type.ts"
import { compileCredentialRegistry } from "./credential_registry_contract.ts"
import { prepareRegistryDeploy } from "./deploy_registry.ts"
import { observeRegistryAnchor } from "./observe_registry_anchor.ts"

const compiledContract = compileCredentialRegistry()

class MidnightRegistryChain implements RegistryChainPort {
  private readonly dependencies: MidnightRegistryChainDependencies

  constructor(dependencies: MidnightRegistryChainDependencies) {
    this.dependencies = dependencies
  }

  async prepareDeploy(generation: number): Promise<PreparedDeploy> {
    return prepareRegistryDeploy({
      dependencies: this.dependencies,
      compiledContract,
      kind: "credential",
      generation,
      issuerPublicKey: function (secret) {
        return pureCircuits.issuerPublicKey(secret)
      },
      what: `the deploy of generation ${generation}`
    })
  }

  async observeAnchor(generation: RegistryGeneration): Promise<AnchorObservation> {
    const { blocks, publicData, networkStepSeconds } = this.dependencies

    return observeRegistryAnchor(blocks, publicData, networkStepSeconds, generation)
  }
}

export default MidnightRegistryChain
