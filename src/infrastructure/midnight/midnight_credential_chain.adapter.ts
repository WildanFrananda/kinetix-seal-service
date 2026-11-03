import { randomBytes } from "node:crypto"
import {
  type CallOptionsWithPrivateState,
  createUnprovenCallTxFromInitialStates,
  getPublicStates
} from "@midnight-ntwrk/midnight-js-contracts"
import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/ledger"

import { type Ledger, ledger, pureCircuits } from "#contracts/credential_registry/contract/index.js"
import type { CredentialChainPort } from "../../application/ports/credential_chain.port.ts"
import type { PredicateChainPort } from "../../application/ports/predicate_chain.port.ts"
import type { RegistrySnapshotSourcePort } from "../../application/ports/registry_snapshot_source.port.ts"
import type { CredentialRecord } from "../../types/credential_record.type.ts"
import type { MidnightCredentialChainDependencies } from "../../types/midnight_credential_chain_dependencies.type.ts"
import type { PlacedPredicate } from "../../types/placed_predicate.type.ts"
import type { RegistryCircuitId } from "../../types/registry_circuit_id.type.ts"
import type { RegistryContract } from "../../types/registry_contract.type.ts"
import type { RegistryPredicate } from "../../types/registry_predicate.type.ts"
import type { RegistryReceipt } from "../../types/registry_receipt.type.ts"
import type { RegistryStateBytes } from "../../types/registry_state_bytes.type.ts"
import { withTimeout } from "../scheduling/with_timeout.ts"
import { credentialLeafOf } from "./credential_leaf.ts"
import { compileCredentialRegistry } from "./credential_registry_contract.ts"
import { issuedLeafIndex } from "./issued_leaf_index.ts"
import { placedPredicatesOf } from "./placed_predicates.ts"
import { submitSealTransaction } from "./submit_seal_transaction.ts"

const compiledContract = compileCredentialRegistry()

class MidnightCredentialChain implements CredentialChainPort, PredicateChainPort, RegistrySnapshotSourcePort {
  private readonly dependencies: MidnightCredentialChainDependencies

  constructor(dependencies: MidnightCredentialChainDependencies) {
    this.dependencies = dependencies
  }

  leafOf(credential: CredentialRecord): Uint8Array {
    return credentialLeafOf(credential)
  }

  async issue(contractAddress: string, leaf: Uint8Array): Promise<RegistryReceipt> {
    return this.call(contractAddress, "issue", [leaf], "an issue")
  }

  async locate(contractAddress: string, leaf: Uint8Array): Promise<bigint | undefined> {
    return issuedLeafIndex((await this.registryLedger(contractAddress)).issued, leaf)
  }

  predicateIdOf(predicate: RegistryPredicate): Uint8Array {
    return pureCircuits.predicateId(predicate)
  }

  async placed(contractAddress: string): Promise<PlacedPredicate[]> {
    return placedPredicatesOf((await this.registryLedger(contractAddress)).predicates)
  }

  async approve(contractAddress: string, predicate: RegistryPredicate): Promise<RegistryReceipt> {
    return this.call(contractAddress, "approvePredicate", [predicate], "a predicate approval")
  }

  async withdraw(contractAddress: string, id: Uint8Array): Promise<RegistryReceipt> {
    return this.call(contractAddress, "withdrawPredicate", [id], "a predicate withdrawal")
  }

  async stateOf(contractAddress: string): Promise<RegistryStateBytes> {
    const { publicData, networkStepSeconds } = this.dependencies
    const states = await withTimeout(
      getPublicStates(publicData, contractAddress),
      networkStepSeconds,
      "reading the registry"
    )

    return {
      contractState: states.contractState.serialize(),
      zswapChainState: states.zswapChainState.serialize(),
      ledgerParameters: states.ledgerParameters.serialize()
    }
  }

  private async registryLedger(contractAddress: string): Promise<Ledger> {
    const { publicData, networkStepSeconds } = this.dependencies
    const state = await withTimeout(
      publicData.queryContractState(contractAddress),
      networkStepSeconds,
      "reading the registry"
    )

    if (state === null) {
      throw new Error(`the registry ${contractAddress} has no state`)
    }

    return ledger(state.data)
  }

  private async call<K extends RegistryCircuitId>(
    contractAddress: string,
    circuitId: K,
    args: CompactContract.CircuitParameters<RegistryContract, K>,
    what: string
  ): Promise<RegistryReceipt> {
    const { zkConfig, issuerSecret, publicData, networkStepSeconds } = this.dependencies
    const states = await withTimeout(
      getPublicStates(publicData, contractAddress),
      networkStepSeconds,
      "reading the registry"
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
      initialPrivateState: { role: "issuer", issuerSecret }
    } as CallOptionsWithPrivateState<RegistryContract, K>

    const call = await createUnprovenCallTxFromInitialStates(zkConfig, options, zswap.encryptionPublicKey)
    const confirmed = await submitSealTransaction(this.dependencies, call.private.unprovenTx, what)

    return { txId: confirmed.txId }
  }
}

export default MidnightCredentialChain
