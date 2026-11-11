import { randomBytes } from "node:crypto"
import {
  createUnprovenCallTxFromInitialStates,
  createUnprovenDeployTxFromVerifierKeys,
  type Ledger9CallOptionsWithPrivateState
} from "@midnight-ntwrk/midnight-js-contracts"
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider"
import { LedgerParameters, ZswapChainState, ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/v9"
import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js"
import {
  ChargedState,
  type ContractState,
  sampleSigningKey
} from "@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime"

import {
  type Contract,
  type Ledger,
  ledger,
  type Predicate,
  pureCircuits
} from "#contracts/credential_registry/contract/index.js"
import {
  compileCredentialRegistry,
  credentialRegistryDirectory
} from "../../../src/infrastructure/midnight/credential_registry_contract.ts"
import type { CredentialRegistryPrivateState } from "../../../src/types/credential_registry_private_state.type.ts"
import type { RegistrySnapshotWire } from "../../../src/types/registry_snapshot_wire.type.ts"
import { decodedContractState, inMemoryCallStates, inMemoryConfig } from "./in_memory_states.ts"

type Registry = Contract<CredentialRegistryPrivateState>
type RegistryCircuit = CompactContract.ProvableCircuitId<Registry>

const zkConfig = new NodeZkConfigProvider<string>(credentialRegistryDirectory)
const compiledContract = compileCredentialRegistry()

class InMemoryCredentialRegistry {
  private readonly address: string
  private readonly state: ContractState
  private readonly zswap = ZswapSecretKeys.fromSeed(randomBytes(32))

  private constructor(address: string, state: ContractState) {
    this.address = address
    this.state = state
  }

  static async deploy(issuerSecret: Uint8Array): Promise<InMemoryCredentialRegistry> {
    const zswap = ZswapSecretKeys.fromSeed(randomBytes(32))
    const deployed = await createUnprovenDeployTxFromVerifierKeys(
      zkConfig,
      zswap.coinPublicKey,
      {
        compiledContract,
        args: [pureCircuits.issuerPublicKey(issuerSecret)],
        signingKey: sampleSigningKey(),
        initialPrivateState: { role: "issuer", issuerSecret }
      },
      zswap.encryptionPublicKey,
      inMemoryConfig
    )

    return new InMemoryCredentialRegistry(
      deployed.public.contractAddress,
      decodedContractState(deployed.public.initialContractState)
    )
  }

  ledger(): Ledger {
    return ledger(this.state.data)
  }

  contractAddress(): string {
    return this.address
  }

  snapshotWire(generation: number): RegistrySnapshotWire {
    return {
      generation,
      networkId: "undeployed",
      contractAddress: this.address,
      contractState: Buffer.from(this.state.serialize()).toString("hex"),
      zswapChainState: Buffer.from(new ZswapChainState().serialize()).toString("hex"),
      ledgerParameters: Buffer.from(LedgerParameters.initialParameters().serialize()).toString("hex"),
      readAt: new Date().toISOString()
    }
  }

  async issue(leaf: Uint8Array, as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("issue", [leaf], as)
  }

  async revoke(index: bigint, as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("revoke", [index], as)
  }

  async approvePredicate(predicate: Predicate, as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("approvePredicate", [predicate], as)
  }

  async withdrawPredicate(id: Uint8Array, as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("withdrawPredicate", [id], as)
  }

  async proposeIssuer(nextIssuerPk: Uint8Array, as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("proposeIssuer", [nextIssuerPk], as)
  }

  async acceptIssuer(as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("acceptIssuer", [], as)
  }

  async pause(as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("pause", [], as)
  }

  async unpause(as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("unpause", [], as)
  }

  async present(challenge: Uint8Array, id: Uint8Array, as: CredentialRegistryPrivateState): Promise<void> {
    await this.call("present", [challenge, id], as)
  }

  private async call<K extends RegistryCircuit>(
    circuitId: K,
    args: CompactContract.CircuitParameters<Registry, K>,
    initialPrivateState: CredentialRegistryPrivateState
  ): Promise<void> {
    const options = {
      compiledContract,
      circuitId,
      contractAddress: this.address,
      args,
      coinPublicKey: this.zswap.coinPublicKey,
      ...inMemoryCallStates(this.state),
      initialPrivateState,
      config: inMemoryConfig
    } as Ledger9CallOptionsWithPrivateState<Registry, K>

    const called = await createUnprovenCallTxFromInitialStates(zkConfig, options, this.zswap.encryptionPublicKey)

    this.state.data = new ChargedState(called.public.nextContractState)
  }
}

export default InMemoryCredentialRegistry
