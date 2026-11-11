import { randomBytes } from "node:crypto"
import {
  createUnprovenCallTxFromInitialStates,
  createUnprovenDeployTxFromVerifierKeys,
  type Ledger9CallOptionsWithPrivateState
} from "@midnight-ntwrk/midnight-js-contracts"
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/v9"
import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js"
import {
  ChargedState,
  type ContractState,
  sampleSigningKey
} from "@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime"

import {
  type Contract,
  type FiledReport,
  type Ledger,
  ledger,
  pureCircuits
} from "#contracts/report_registry/contract/index.js"
import {
  compileReportRegistry,
  reportRegistryDirectory
} from "../../../src/infrastructure/midnight/report_registry_contract.ts"
import type { ReportRegistryPrivateState } from "../../../src/types/report_registry_private_state.type.ts"
import { decodedContractState, inMemoryCallStates, inMemoryConfig } from "./in_memory_states.ts"

type Registry = Contract<ReportRegistryPrivateState>
type RegistryCircuit = CompactContract.ProvableCircuitId<Registry>

const zkConfig = new NodeZkConfigProvider<string>(reportRegistryDirectory)
const compiledContract = compileReportRegistry()

class InMemoryReportRegistry {
  private readonly address: string
  private readonly state: ContractState
  private readonly zswap = ZswapSecretKeys.fromSeed(randomBytes(32))

  private constructor(address: string, state: ContractState) {
    this.address = address
    this.state = state
  }

  static async deploy(issuerSecret: Uint8Array): Promise<InMemoryReportRegistry> {
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

    return new InMemoryReportRegistry(
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

  async grant(leaf: Uint8Array, as: ReportRegistryPrivateState): Promise<void> {
    await this.call("grant", [leaf], as)
  }

  async seedReport(nullifier: Uint8Array, report: FiledReport, as: ReportRegistryPrivateState): Promise<void> {
    await this.call("seedReport", [nullifier, report], as)
  }

  async proposeIssuer(nextIssuerPk: Uint8Array, as: ReportRegistryPrivateState): Promise<void> {
    await this.call("proposeIssuer", [nextIssuerPk], as)
  }

  async acceptIssuer(as: ReportRegistryPrivateState): Promise<void> {
    await this.call("acceptIssuer", [], as)
  }

  async pause(as: ReportRegistryPrivateState): Promise<void> {
    await this.call("pause", [], as)
  }

  async unpause(as: ReportRegistryPrivateState): Promise<void> {
    await this.call("unpause", [], as)
  }

  async report(
    merchant: Uint8Array,
    window: bigint,
    digest: Uint8Array,
    as: ReportRegistryPrivateState
  ): Promise<void> {
    await this.call("report", [merchant, window, digest], as)
  }

  private async call<K extends RegistryCircuit>(
    circuitId: K,
    args: CompactContract.CircuitParameters<Registry, K>,
    initialPrivateState: ReportRegistryPrivateState
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

export default InMemoryReportRegistry
