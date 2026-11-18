import { pureCircuits } from "#contracts/report_registry/contract/index.js"
import type { RegistryChainPort } from "../../application/ports/registry_chain.port.ts"
import type { AnchorObservation } from "../../types/anchor_observation.type.ts"
import type { MidnightRegistryChainDependencies } from "../../types/midnight_registry_chain_dependencies.type.ts"
import type { PreparedDeploy } from "../../types/prepared_deploy.type.ts"
import type { RegistryGeneration } from "../../types/registry_generation.type.ts"
import { prepareRegistryDeploy } from "./deploy_registry.ts"
import { observeRegistryAnchor } from "./observe_registry_anchor.ts"
import { compileReportRegistry } from "./report_registry_contract.ts"

const compiledContract = compileReportRegistry()

class MidnightReportRegistryChain implements RegistryChainPort {
  private readonly dependencies: MidnightRegistryChainDependencies

  constructor(dependencies: MidnightRegistryChainDependencies) {
    this.dependencies = dependencies
  }

  async prepareDeploy(generation: number): Promise<PreparedDeploy> {
    return prepareRegistryDeploy({
      dependencies: this.dependencies,
      compiledContract,
      kind: "report",
      generation,
      issuerPublicKey: (secret) => pureCircuits.issuerPublicKey(secret),
      what: `the deploy of report registry generation ${generation}`
    })
  }

  async observeAnchor(generation: RegistryGeneration): Promise<AnchorObservation> {
    const { blocks, publicData, networkStepSeconds } = this.dependencies

    return observeRegistryAnchor(blocks, publicData, networkStepSeconds, generation)
  }
}

export default MidnightReportRegistryChain
