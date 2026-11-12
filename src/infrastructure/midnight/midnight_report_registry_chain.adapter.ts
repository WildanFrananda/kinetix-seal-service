import { randomBytes } from "node:crypto"
import { createUnprovenDeployTxFromVerifierKeys } from "@midnight-ntwrk/midnight-js-contracts"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/v9"

import { pureCircuits } from "#contracts/report_registry/contract/index.js"
import type { RegistryChainPort } from "../../application/ports/registry_chain.port.ts"
import type { AnchorObservation } from "../../types/anchor_observation.type.ts"
import type { DeployReceipt } from "../../types/deploy_receipt.type.ts"
import type { MidnightRegistryChainDependencies } from "../../types/midnight_registry_chain_dependencies.type.ts"
import type { PreparedDeploy } from "../../types/prepared_deploy.type.ts"
import type { RegistryGeneration } from "../../types/registry_generation.type.ts"
import { maintenanceSigningKey } from "./maintenance_signing_key.ts"
import { observeRegistryAnchor } from "./observe_registry_anchor.ts"
import { compileReportRegistry } from "./report_registry_contract.ts"
import { submitSealTransaction } from "./submit_seal_transaction.ts"

const compiledContract = compileReportRegistry()

class MidnightReportRegistryChain implements RegistryChainPort {
  private readonly dependencies: MidnightRegistryChainDependencies

  constructor(dependencies: MidnightRegistryChainDependencies) {
    this.dependencies = dependencies
  }

  async prepareDeploy(generation: number): Promise<PreparedDeploy> {
    const { zkConfig, issuerSecret, config } = this.dependencies
    const zswap = ZswapSecretKeys.fromSeed(randomBytes(32))
    const deploy = await createUnprovenDeployTxFromVerifierKeys(
      zkConfig,
      zswap.coinPublicKey,
      {
        compiledContract,
        args: [pureCircuits.issuerPublicKey(issuerSecret)],
        signingKey: maintenanceSigningKey(issuerSecret, "report", generation),
        initialPrivateState: { role: "issuer", issuerSecret }
      },
      zswap.encryptionPublicKey,
      config
    )

    const dependencies = this.dependencies

    return {
      contractAddress: deploy.public.contractAddress,
      async submit(): Promise<DeployReceipt> {
        return submitSealTransaction(
          dependencies,
          deploy.private.unprovenTx,
          `the deploy of report registry generation ${generation}`
        )
      }
    }
  }

  async observeAnchor(generation: RegistryGeneration): Promise<AnchorObservation> {
    const { blocks, publicData, networkStepSeconds } = this.dependencies

    return observeRegistryAnchor(blocks, publicData, networkStepSeconds, generation)
  }
}

export default MidnightReportRegistryChain
