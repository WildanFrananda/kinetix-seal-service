import { randomBytes } from "node:crypto"
import { createUnprovenDeployTxFromVerifierKeys } from "@midnight-ntwrk/midnight-js-contracts"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/ledger"

import { pureCircuits } from "#contracts/credential_registry/contract/index.js"
import type { RegistryChainPort } from "../../application/ports/registry_chain.port.ts"
import type { AnchorObservation } from "../../types/anchor_observation.type.ts"
import type { DeployReceipt } from "../../types/deploy_receipt.type.ts"
import type { MidnightRegistryChainDependencies } from "../../types/midnight_registry_chain_dependencies.type.ts"
import type { PreparedDeploy } from "../../types/prepared_deploy.type.ts"
import type { RegistryGeneration } from "../../types/registry_generation.type.ts"
import { withTimeout } from "../scheduling/with_timeout.ts"
import { compileCredentialRegistry } from "./credential_registry_contract.ts"
import { maintenanceSigningKey } from "./maintenance_signing_key.ts"
import { submitSealTransaction } from "./submit_seal_transaction.ts"

const compiledContract = compileCredentialRegistry()

class MidnightRegistryChain implements RegistryChainPort {
  private readonly dependencies: MidnightRegistryChainDependencies

  constructor(dependencies: MidnightRegistryChainDependencies) {
    this.dependencies = dependencies
  }

  async prepareDeploy(generation: number): Promise<PreparedDeploy> {
    const { zkConfig, issuerSecret } = this.dependencies
    const zswap = ZswapSecretKeys.fromSeed(randomBytes(32))
    const deploy = await createUnprovenDeployTxFromVerifierKeys(
      zkConfig,
      zswap.coinPublicKey,
      {
        compiledContract,
        args: [pureCircuits.issuerPublicKey(issuerSecret)],
        signingKey: maintenanceSigningKey(issuerSecret, generation),
        initialPrivateState: { role: "issuer", issuerSecret }
      },
      zswap.encryptionPublicKey
    )
    const dependencies = this.dependencies

    return {
      contractAddress: deploy.public.contractAddress,
      async submit(): Promise<DeployReceipt> {
        return submitSealTransaction(dependencies, deploy.private.unprovenTx, `the deploy of generation ${generation}`)
      }
    }
  }

  async observeAnchor(generation: RegistryGeneration): Promise<AnchorObservation> {
    const { blocks, publicData, networkStepSeconds } = this.dependencies

    if (generation.anchorHeight === undefined || generation.anchorHash === undefined) {
      return "unknown"
    }

    const hash = await blocks.hashAt(generation.anchorHeight)

    if (hash !== undefined) {
      return hash === generation.anchorHash ? "unchanged" : "replaced"
    }

    const [tip, state] = await Promise.all([
      blocks.tipHeight(),
      withTimeout(publicData.queryContractState(generation.contractAddress), networkStepSeconds, "reading the registry")
    ])

    return tip < generation.anchorHeight && state === null ? "replaced" : "unknown"
  }
}

export default MidnightRegistryChain
