import { randomBytes } from "node:crypto"
import { createUnprovenDeployTxFromVerifierKeys } from "@midnight-ntwrk/midnight-js-contracts"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/v9"

import type { DeployReceipt } from "../../types/deploy_receipt.type.ts"
import type { MidnightRegistryChainDependencies } from "../../types/midnight_registry_chain_dependencies.type.ts"
import type { PreparedDeploy } from "../../types/prepared_deploy.type.ts"
import type { RegistryKind } from "../../types/registry_kind.type.ts"
import { maintenanceSigningKey } from "./maintenance_signing_key.ts"
import { submitSealTransaction } from "./submit_seal_transaction.ts"

async function prepareRegistryDeploy(options: {
  dependencies: MidnightRegistryChainDependencies
  compiledContract: unknown
  kind: RegistryKind
  generation: number
  issuerPublicKey: (secret: Uint8Array) => unknown
  what: string
}): Promise<PreparedDeploy> {
  const { zkConfig, issuerSecret, config } = options.dependencies
  const zswap = ZswapSecretKeys.fromSeed(randomBytes(32))
  const deploy = await createUnprovenDeployTxFromVerifierKeys(
    zkConfig,
    zswap.coinPublicKey,
    {
      compiledContract: options.compiledContract as never,
      args: [options.issuerPublicKey(issuerSecret)],
      signingKey: maintenanceSigningKey(issuerSecret, options.kind, options.generation),
      initialPrivateState: { role: "issuer", issuerSecret }
    } as never,
    zswap.encryptionPublicKey,
    config
  )

  const dependencies = options.dependencies
  const what = options.what

  return {
    contractAddress: deploy.public.contractAddress,
    async submit(): Promise<DeployReceipt> {
      return submitSealTransaction(dependencies, deploy.private.unprovenTx, what)
    }
  }
}

export { prepareRegistryDeploy }
