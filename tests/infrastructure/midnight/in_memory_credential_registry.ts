import { randomBytes } from "node:crypto"
import {
  type CallOptionsWithPrivateState,
  createUnprovenCallTxFromInitialStates,
  createUnprovenDeployTxFromVerifierKeys
} from "@midnight-ntwrk/midnight-js-contracts"
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider"
import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js"
import {
  ChargedState,
  type ContractState,
  sampleSigningKey
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime"
import { LedgerParameters, ZswapChainState, ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/ledger"

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
      zswap.encryptionPublicKey
    )

    return new InMemoryCredentialRegistry(deployed.public.contractAddress, deployed.public.initialContractState)
  }

  ledger(): Ledger {
    return ledger(this.state.data)
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
      initialContractState: this.state,
      initialZswapChainState: new ZswapChainState(),
      ledgerParameters: LedgerParameters.initialParameters(),
      initialPrivateState
    } as CallOptionsWithPrivateState<Registry, K>
    const called = await createUnprovenCallTxFromInitialStates(zkConfig, options, this.zswap.encryptionPublicKey)

    this.state.data = new ChargedState(called.public.nextContractState)
  }
}

export default InMemoryCredentialRegistry
