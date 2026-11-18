import { getPublicStates } from "@midnight-ntwrk/midnight-js-contracts"
import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js"
import { type Ledger, ledger, pureCircuits } from "#contracts/credential_registry/contract/index.js"
import type { CredentialChainPort } from "../../application/ports/credential_chain.port.ts"
import type { PredicateChainPort } from "../../application/ports/predicate_chain.port.ts"
import type { PresentationLedgerPort } from "../../application/ports/presentation_ledger.port.ts"
import type { RegistrySnapshotSourcePort } from "../../application/ports/registry_snapshot_source.port.ts"
import { hexOf } from "../../domain/hex.ts"
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
import { callRegistryCircuit, readContractLedger } from "./registry_circuit_client.ts"

const compiledContract = compileCredentialRegistry()
const registryLabel = "the registry"

class MidnightCredentialChain
  implements CredentialChainPort, PredicateChainPort, PresentationLedgerPort, RegistrySnapshotSourcePort
{
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

  async presentations(contractAddress: string): Promise<Map<string, string>> {
    const answers = new Map<string, string>()

    for (const [challenge, predicateId] of (await this.registryLedger(contractAddress)).presentations) {
      answers.set(hexOf(challenge), hexOf(predicateId))
    }

    return answers
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
    return readContractLedger(this.dependencies, contractAddress, (data) => ledger(data as never), registryLabel)
  }

  private async call<K extends RegistryCircuitId>(
    contractAddress: string,
    circuitId: K,
    args: CompactContract.CircuitParameters<RegistryContract, K>,
    what: string
  ): Promise<RegistryReceipt> {
    return callRegistryCircuit<RegistryContract, K>({
      dependencies: this.dependencies,
      compiledContract,
      contractAddress,
      circuitId,
      args,
      label: registryLabel,
      what
    })
  }
}

export default MidnightCredentialChain
