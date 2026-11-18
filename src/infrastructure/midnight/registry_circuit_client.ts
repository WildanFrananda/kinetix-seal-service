import { randomBytes } from "node:crypto"
import { ContractState } from "@midnight-ntwrk/compact-runtime"
import {
  createUnprovenCallTxFromInitialStates,
  getPublicStates,
  type Ledger9CallOptionsWithPrivateState
} from "@midnight-ntwrk/midnight-js-contracts"
import { ZswapSecretKeys } from "@midnight-ntwrk/midnight-js-protocol/v9"
import type { Contract as CompactContract } from "@midnight-ntwrk/midnight-js-protocol/v9/compact-js"

import type { CallRegistryCircuitOptions } from "../../types/call_registry_circuit_options.type.ts"
import type { MidnightCredentialChainDependencies } from "../../types/midnight_credential_chain_dependencies.type.ts"
import type { RegistryReceipt } from "../../types/registry_receipt.type.ts"
import { withTimeout } from "../scheduling/with_timeout.ts"
import { submitSealTransaction } from "./submit_seal_transaction.ts"

async function readContractLedger<L>(
  dependencies: MidnightCredentialChainDependencies,
  contractAddress: string,
  decode: (data: unknown) => L,
  label: string
): Promise<L> {
  const { publicData, networkStepSeconds } = dependencies
  const state = await withTimeout(
    publicData.queryContractState(contractAddress),
    networkStepSeconds,
    `reading ${label}`
  )

  if (state === null) {
    throw new Error(`${label} ${contractAddress} has no state`)
  }

  return decode(state.contractState.deserialize({ v9: ContractState }).data)
}

async function callRegistryCircuit<C extends CompactContract.Any, K extends string>(
  options: CallRegistryCircuitOptions<K>
): Promise<RegistryReceipt> {
  const { zkConfig, issuerSecret, config, publicData, networkStepSeconds } = options.dependencies
  const states = await withTimeout(
    getPublicStates(publicData, options.contractAddress),
    networkStepSeconds,
    `reading ${options.label}`
  )

  const zswap = ZswapSecretKeys.fromSeed(randomBytes(32))
  const callOptions = {
    compiledContract: options.compiledContract,
    circuitId: options.circuitId,
    contractAddress: options.contractAddress,
    args: options.args,
    coinPublicKey: zswap.coinPublicKey,
    initialContractState: states.contractState,
    initialZswapChainState: states.zswapChainState,
    ledgerParameters: states.ledgerParameters,
    initialPrivateState: { role: "issuer", issuerSecret },
    config
  } as unknown as Ledger9CallOptionsWithPrivateState<C, never>

  const call = await createUnprovenCallTxFromInitialStates(zkConfig, callOptions, zswap.encryptionPublicKey)
  const confirmed = await submitSealTransaction(options.dependencies, call.private.unprovenTx, options.what)

  return { txId: confirmed.txId }
}

export { callRegistryCircuit, readContractLedger }
