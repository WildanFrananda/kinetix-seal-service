import { randomBytes } from "node:crypto"
import { createUnprovenDeployTxFromVerifierKeys } from "@midnight-ntwrk/midnight-js-contracts"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/ledger"
import { SucceedEntirely } from "@midnight-ntwrk/midnight-js-types"

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
    const chain = this

    return {
      contractAddress: deploy.public.contractAddress,
      async submit(): Promise<DeployReceipt> {
        return chain.submit(deploy.private.unprovenTx, `the deploy of generation ${generation}`)
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

  private async submit(
    transaction: Parameters<MidnightRegistryChainDependencies["proofs"]["proveTx"]>[0],
    what: string
  ): Promise<DeployReceipt> {
    const { payer, proofs, publicData, networkStepSeconds } = this.dependencies
    const proven = await withTimeout(proofs.proveTx(transaction), networkStepSeconds, `proving ${what}`)
    const txId = await withTimeout(payer.pay(proven.serialize()), networkStepSeconds, `paying for ${what}`)
    const data = await withTimeout(publicData.watchForTxData(txId), networkStepSeconds, `confirming ${what}`)

    if (data.status !== SucceedEntirely) {
      throw new Error(`${what} finished ${data.status} (tx ${txId})`)
    }

    return { txId, blockHeight: data.blockHeight, blockHash: data.blockHash }
  }
}

export default MidnightRegistryChain
