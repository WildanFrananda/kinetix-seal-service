import { randomBytes } from "node:crypto"
import { ContractState } from "@midnight-ntwrk/compact-runtime"
import {
  createUnprovenCallTxFromInitialStates,
  getPublicStates,
  type Ledger9CallOptionsWithPrivateState
} from "@midnight-ntwrk/midnight-js-contracts"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/v9"
import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js"

import { type Ledger, ledger, pureCircuits } from "#contracts/report_registry/contract/index.js"
import type { ReportChainPort } from "../../application/ports/report_chain.port.ts"
import { merchantTagOf } from "../../domain/merchant_tag.ts"
import type { MidnightCredentialChainDependencies } from "../../types/midnight_credential_chain_dependencies.type.ts"
import type { RegistryReceipt } from "../../types/registry_receipt.type.ts"
import type { ReportRegistryCircuitId } from "../../types/report_registry_circuit_id.type.ts"
import type { ReportRegistryContract } from "../../types/report_registry_contract.type.ts"
import type { RightLeafParts } from "../../types/right_leaf_parts.type.ts"
import { withTimeout } from "../scheduling/with_timeout.ts"
import { issuedLeafIndex } from "./issued_leaf_index.ts"
import { compileReportRegistry } from "./report_registry_contract.ts"
import { submitSealTransaction } from "./submit_seal_transaction.ts"

const compiledContract = compileReportRegistry()

class MidnightReportChain implements ReportChainPort {
  private readonly dependencies: MidnightCredentialChainDependencies

  constructor(dependencies: MidnightCredentialChainDependencies) {
    this.dependencies = dependencies
  }

  merchantTagOf(merchantPrincipalId: string): Uint8Array {
    return merchantTagOf(this.dependencies.issuerSecret, merchantPrincipalId)
  }

  rightLeafOf(parts: RightLeafParts): Uint8Array {
    return pureCircuits.rightLeaf(parts.merchantTag, BigInt(parts.window), parts.order, parts.reporterKey)
  }

  async grant(contractAddress: string, leaf: Uint8Array): Promise<RegistryReceipt> {
    return this.call(contractAddress, "grant", [leaf], "a report right's grant")
  }

  async locate(contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined> {
    return issuedLeafIndex((await this.registryLedger(contractAddress)).rights, leaf)
  }

  private async registryLedger(contractAddress: string): Promise<Ledger> {
    const { publicData, networkStepSeconds } = this.dependencies
    const state = await withTimeout(
      publicData.queryContractState(contractAddress),
      networkStepSeconds,
      "reading the report registry"
    )

    if (state === null) {
      throw new Error(`the report registry ${contractAddress} has no state`)
    }

    return ledger(state.contractState.deserialize({ v9: ContractState }).data)
  }

  private async call<K extends ReportRegistryCircuitId>(
    contractAddress: string,
    circuitId: K,
    args: CompactContract.CircuitParameters<ReportRegistryContract, K>,
    what: string
  ): Promise<RegistryReceipt> {
    const { zkConfig, issuerSecret, config, publicData, networkStepSeconds } = this.dependencies
    const states = await withTimeout(
      getPublicStates(publicData, contractAddress),
      networkStepSeconds,
      "reading the report registry"
    )

    const zswap = ZswapSecretKeys.fromSeed(randomBytes(32))
    const options = {
      compiledContract,
      circuitId,
      contractAddress,
      args,
      coinPublicKey: zswap.coinPublicKey,
      initialContractState: states.contractState,
      initialZswapChainState: states.zswapChainState,
      ledgerParameters: states.ledgerParameters,
      initialPrivateState: { role: "issuer", issuerSecret },
      config
    } as Ledger9CallOptionsWithPrivateState<ReportRegistryContract, K>

    const call = await createUnprovenCallTxFromInitialStates(zkConfig, options, zswap.encryptionPublicKey)
    const confirmed = await submitSealTransaction(this.dependencies, call.private.unprovenTx, what)

    return { txId: confirmed.txId }
  }
}

export default MidnightReportChain
